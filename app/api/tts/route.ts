// POST /api/tts — Generate speech audio from text
// Tries Piper TTS (free, local) first, then ElevenLabs as fallback
// Returns { audioUrl, engine, duration } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { env } from "@/config/env";
import { spawn } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId, speed, engine } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    // ── Try Gemini Premium if explicitly requested ──
    if (engine === "gemini" || engine === "premium") {
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

    // Try 1: Piper TTS (free, local) — skip if Pro/Premium explicitly requested
    if (engine === "elevenlabs" || engine === "pro") {
      // Jump straight to ElevenLabs — handled below
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
          return NextResponse.json({ audioUrl: url, engine: "piper", text: text.slice(0, 100) });
        }
      }
    } catch { /* Piper failed */ }

    // Try 2: ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const vid = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
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

        if (res.ok) {
          const mp3File = outFile.replace(".wav", ".mp3");
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(mp3File, buffer);
          const url = `/api/media/audio/tts/${path.basename(mp3File)}`;
          return NextResponse.json({ audioUrl: url, engine: "elevenlabs", text: text.slice(0, 100) });
        }
      } catch { /* ElevenLabs failed */ }
    }

    // Try 3: Windows PowerShell speech synthesis (SAPI)
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
          return NextResponse.json({ audioUrl: url, engine: "windows-sapi", text: text.slice(0, 100) });
        }
      } catch { /* Windows SAPI failed */ }
    }

    // Try 4: FFmpeg-based silent placeholder with text burned in (last resort)
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
