// POST /api/tts — Generate speech audio from text
// Provider chain: piper (free local) → fal-narrator → elevenlabs → windows-sapi → placeholder
// Returns { audioUrl, engine, durationMs } or { error }
// Accepts `provider` field: "piper" | "fal-narrator" | "elevenlabs" | "karaoke"

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { env } from "@/config/env";
import { spawn, execSync } from "child_process";

// ── Measure audio duration after generation ───────────────────────────────────
// Tries FFprobe first; falls back to file-size heuristics for WAV/MP3.
function getAudioDurationMs(filePath: string, engine: "piper" | "wav" | "mp3" | "sapi" = "wav"): number {
  // 1. FFprobe (accurate)
  try {
    const out = execSync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
      { timeout: 5000 }
    ).toString();
    const data = JSON.parse(out) as { format?: { duration?: string } };
    const dur = parseFloat(data.format?.duration ?? "0");
    if (dur > 0) return Math.round(dur * 1000);
  } catch { /* ffprobe not available */ }

  // 2. File-size fallback
  try {
    const sizeBytes = fs.statSync(filePath).size;
    if (engine === "mp3") {
      // approx 64 kbps for Piper/kokoro output
      return Math.round((sizeBytes / (64 * 125)) * 1000);
    }
    // WAV at 22050 Hz, 16-bit mono (Piper default) or SAPI (16-bit, 16kHz mono)
    const sampleRate = engine === "sapi" ? 16000 : 22050;
    return Math.round((sizeBytes / (sampleRate * 2)) * 1000);
  } catch { return 0; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId, speed, engine, provider } = body;

    // Resolve effective provider — `provider` field takes precedence over legacy `engine`
    // "karaoke" maps to windows-sapi (browser speech API handled client-side)
    const effectiveProvider: string = provider || engine || "auto";

    if (!text?.trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    // ── Karaoke / browser-speech provider — handled client-side, signal back ──
    if (effectiveProvider === "karaoke") {
      return NextResponse.json({
        audioUrl: null, engine: "browser-speech", fallback: "browser",
        text: text.slice(0, 100),
        message: "Use Web Speech API (SpeechSynthesis) in the browser for karaoke mode.",
      });
    }

    // ── Try Gemini Premium if explicitly requested ──
    if (effectiveProvider === "gemini" || effectiveProvider === "premium") {
      try {
        const { generateSpeechGemini } = await import("@/lib/generation/gateways/fal");
        const result = await generateSpeechGemini(text, { voice: voiceId || "Charon" });
        if (result.audioUrl) {
          return NextResponse.json({ audioUrl: result.audioUrl, engine: "gemini-flash-tts", text: text.slice(0, 100) });
        }
      } catch { /* fall through to Piper */ }
    }

    const audioDir = path.join(env.storagePath, "audio", "tts");
    fs.mkdirSync(audioDir, { recursive: true });
    const outFile = path.join(audioDir, `tts_${Date.now()}.wav`);

    // Try 1: Piper TTS (free, local) — skip if elevated provider explicitly requested
    if (effectiveProvider === "elevenlabs" || effectiveProvider === "pro" || effectiveProvider === "fal-narrator") {
      // Jump straight to requested provider — handled below
    } else try {
      const piperPath = process.env.PIPER_BIN || path.join(os.homedir(), "piper", "piper");
      const piperModel = path.join(env.storagePath, "..", "piper", "en_US-lessac-medium.onnx");

      if (fs.existsSync(piperPath) && fs.existsSync(piperModel)) {
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(piperPath, [
            "--model", piperModel,
            "--output_file", outFile,
            ...(speed ? ["--length_scale", String(1 / (speed || 1))] : []),
          ]);
          proc.stdin.write(text);
          proc.stdin.end();
          const timer = setTimeout(() => { proc.kill(); reject(new Error("Piper timeout")); }, 30000);
          proc.on("close", (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`Piper exit ${code}`)); });
          proc.on("error", (e) => { clearTimeout(timer); reject(e); });
        });

        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
          const url = `/api/media/audio/tts/${path.basename(outFile)}`;
          const durationMs = getAudioDurationMs(outFile, "wav");
          return NextResponse.json({ audioUrl: url, engine: "piper", text: text.slice(0, 100), durationMs });
        }
      }
    } catch { /* Piper failed */ }

    // Try 2: FAL Narrator — fal-ai/kokoro TTS (between Piper and ElevenLabs in quality)
    // Triggers when provider="fal-narrator" OR when Piper fails and provider is "auto"
    const useFalNarrator = effectiveProvider === "fal-narrator" || effectiveProvider === "fal";
    if (useFalNarrator && process.env.FAL_KEY) {
      try {
        const falRes = await fetch("https://fal.run/fal-ai/kokoro/american-english", {
          method: "POST",
          headers: {
            "Authorization": `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: text,
            voice: voiceId || "af_sky",
            speed: speed || 1.0,
          }),
        });

        if (!falRes.ok) {
          const falBody = await falRes.text();
          console.error(`FAL Narrator TTS failed ${falRes.status}:`, falBody.slice(0, 200));
          throw new Error(`FAL Narrator ${falRes.status}: ${falBody.slice(0, 200)}`);
        }

        const falData = await falRes.json() as { audio_url?: string; audio?: { url?: string } };
        const falAudioUrl = falData.audio_url || falData.audio?.url;
        if (falAudioUrl) {
          // Download FAL audio to local storage
          const falAudioRes = await fetch(falAudioUrl);
          if (falAudioRes.ok) {
            const mp3File = outFile.replace(".wav", "_fal.mp3");
            const buffer = Buffer.from(await falAudioRes.arrayBuffer());
            fs.writeFileSync(mp3File, buffer);
            const url = `/api/media/audio/tts/${path.basename(mp3File)}`;
            const durationMs = getAudioDurationMs(mp3File, "mp3");
            return NextResponse.json({ audioUrl: url, engine: "fal-narrator", text: text.slice(0, 100), durationMs });
          }
        }
      } catch (err) {
        console.error("FAL Narrator TTS failed:", JSON.stringify(err instanceof Error ? err.message : err));
        // Fall through to ElevenLabs if not explicitly requested
        if (effectiveProvider === "fal-narrator" || effectiveProvider === "fal") {
          return NextResponse.json({ error: err instanceof Error ? err.message : "FAL Narrator failed" }, { status: 500 });
        }
      }
    }

    // Try 3: ElevenLabs — premium quality, explicit error surfacing (no silent swallow)
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const vid = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah
        const elevenLabsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });

        // Surface 401/quota/4xx errors explicitly — do NOT swallow them silently
        if (!elevenLabsRes.ok) {
          const body = await elevenLabsRes.text();
          throw new Error(`ElevenLabs ${elevenLabsRes.status}: ${body.slice(0, 200)}`);
        }

        const mp3File = outFile.replace(".wav", ".mp3");
        const buffer = Buffer.from(await elevenLabsRes.arrayBuffer());
        fs.writeFileSync(mp3File, buffer);
        const url = `/api/media/audio/tts/${path.basename(mp3File)}`;
        const durationMs = getAudioDurationMs(mp3File, "mp3");
        return NextResponse.json({ audioUrl: url, engine: "elevenlabs", text: text.slice(0, 100), durationMs });
      } catch (err) {
        console.error("ElevenLabs TTS failed:", JSON.stringify(err instanceof Error ? err.message : err));
        // If ElevenLabs was explicitly requested, return the error — don't fall through
        if (effectiveProvider === "elevenlabs" || effectiveProvider === "pro") {
          return NextResponse.json({ error: err instanceof Error ? err.message : "ElevenLabs TTS failed" }, { status: 500 });
        }
        // Otherwise fall through to SAPI fallback
      }
    }

    // Try 4: Windows PowerShell speech synthesis (SAPI) / karaoke fallback
    if (process.platform === "win32") {
      try {
        const wavFile = outFile.replace(".wav", "_sapi.wav");
        const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile("${wavFile.replace(/\\/g, "\\\\")}")
$synth.Rate = ${speed && speed > 1 ? 2 : speed && speed < 0.8 ? -2 : 0}
$synth.Speak("${text.replace(/"/g, '`"').replace(/\n/g, ' ').slice(0, 2000)}")
$synth.Dispose()
`;
        const { execFileSync } = await import("child_process");
        execFileSync("powershell", ["-NoProfile", "-Command", psScript], { timeout: 30000 });
        if (fs.existsSync(wavFile) && fs.statSync(wavFile).size > 1000) {
          const url = `/api/media/audio/tts/${path.basename(wavFile)}`;
          const durationMs = getAudioDurationMs(wavFile, "sapi");
          return NextResponse.json({ audioUrl: url, engine: "windows-sapi", text: text.slice(0, 100), durationMs });
        }
      } catch { /* Windows SAPI failed */ }
    }

    // Try 5: FFmpeg-based silent placeholder with text burned in (last resort)
    try {
      const silentFile = outFile.replace(".wav", "_silent.mp3");
      const { execFileSync } = await import("child_process");
      // Generate a short tone as placeholder audio (user knows narration needs real TTS)
      execFileSync(env.ffmpegPath, [
        "-f", "lavfi", "-i", `sine=f=440:d=0.5,volume=0.1`,
        "-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono`,
        "-filter_complex", `[0][1]concat=n=2:v=0:a=1`,
        "-t", String(Math.min(Math.ceil(text.length / 15), 30)),
        "-y", silentFile,
      ], { timeout: 15000 });
      if (fs.existsSync(silentFile)) {
        const url = `/api/media/audio/tts/${path.basename(silentFile)}`;
        return NextResponse.json({ audioUrl: url, engine: "placeholder", text: text.slice(0, 100), message: "Placeholder audio. Install Piper TTS for real narration." });
      }
    } catch { /* placeholder failed */ }

    return NextResponse.json({
      audioUrl: null,
      engine: "none",
      fallback: "browser",
      text: text.slice(0, 100),
      message: "No TTS engine available. Install Piper TTS or configure ELEVENLABS_API_KEY.",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "TTS failed" }, { status: 500 });
  }
}
