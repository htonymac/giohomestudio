// POST /api/tts — Generate speech audio from text
// Provider chain: piper (free local) → fal-narrator → fal-narrator-gemini → elevenlabs → windows-sapi → placeholder
// Returns { audioUrl, engine, durationMs } or { error }
// Accepts `provider` field: "piper" | "fal-narrator" | "fal-narrator-gemini" | "elevenlabs" | "karaoke"
// fal-narrator = FAL Standard (fal-ai/kokoro-82m) — fast, smaller model
// fal-narrator-gemini = FAL Pro (fal-ai/kokoro) — full model, higher quality

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { env } from "@/config/env";
import { spawn, execSync } from "child_process";
import { extractEmotion, elevenLabsSettingsFor, type Emotion } from "@/lib/dialogue-emotion";

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
    // Optional emotion override — caller can force a specific emotion (e.g. from a UI dropdown).
    // Otherwise we auto-detect from punctuation / adverbs / ALL CAPS.
    const overrideEmotion: Emotion | undefined = body.emotion;

    // Resolve effective provider — `provider` field takes precedence over legacy `engine`
    // "karaoke" maps to windows-sapi (browser speech API handled client-side)
    const effectiveProvider: string = provider || engine || "auto";

    if (!text?.trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    // ── PHASE 1: emotion preprocessing ──
    // Detect emotion ONCE up front; pass cleaned text to whichever engine wins.
    // ElevenLabs gets emotion-specific voice_settings for inflection.
    // Piper / FAL Kokoro / SAPI ignore — they just receive the cleaned text
    // (with directive adverbs like "she whispered" stripped).
    const detected = extractEmotion(text);
    const finalEmotion: Emotion = overrideEmotion || detected.emotion;
    const speakText = detected.cleanText || text;

    // ── Karaoke / browser-speech provider — handled client-side, signal back ──
    if (effectiveProvider === "karaoke") {
      return NextResponse.json({
        audioUrl: null, engine: "browser-speech", fallback: "browser",
        text: text.slice(0, 100),
        message: "Use Web Speech API (SpeechSynthesis) in the browser for karaoke mode.",
      });
    }

    // ── Edge-TTS (free Microsoft Neural, includes Nigerian voices) ──
    // Henry 2026-06-04: GHS Standard+ tier. Free + near-ElevenLabs quality.
    // Voices like en-NG-EzinneNeural give Andio a local-market advantage.
    // Requires `pip install edge-tts` on the server; falls through to Piper on any failure.
    if (effectiveProvider === "edge-tts" || effectiveProvider === "edge") {
      const audioDir = path.join(env.storagePath, "audio", "tts");
      fs.mkdirSync(audioDir, { recursive: true });
      const outFile = path.join(audioDir, `tts_edge_${Date.now()}.mp3`);
      const edgeVoice = voiceId || "en-NG-EzinneNeural";
      try {
        // edge-tts pip-installs to ~/.local/bin which Next.js process doesn't have on PATH.
        // Try explicit path on Linux server, fall back to PATH name on dev/other envs.
        const edgeBin = process.env.EDGE_TTS_BIN
          || (fs.existsSync(path.join(os.homedir(), ".local/bin/edge-tts")) ? path.join(os.homedir(), ".local/bin/edge-tts") : "edge-tts");
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(edgeBin, ["--voice", edgeVoice, "--text", speakText, "--write-media", outFile]);
          let stderr = "";
          proc.stderr?.on("data", c => { stderr += c.toString(); });
          const timer = setTimeout(() => { proc.kill(); reject(new Error(`edge-tts timeout`)); }, 60_000);
          proc.on("close", code => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`edge-tts exit ${code}: ${stderr.slice(0, 200)}`));
          });
          proc.on("error", e => { clearTimeout(timer); reject(e); });
        });
        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 500) {
          const url = `/api/media/audio/tts/${path.basename(outFile)}`;
          const durationMs = getAudioDurationMs(outFile, "mp3");
          console.log(`[tts.edge] OK ${(durationMs/1000).toFixed(1)}s audio for ${speakText.length} chars, voice=${edgeVoice}`);
          return NextResponse.json({ audioUrl: url, engine: "edge-tts", text: text.slice(0, 100), durationMs });
        }
      } catch (e) {
        console.error("[tts.edge] FAILED:", e instanceof Error ? e.message : String(e));
      }
      // Fall through to Piper on any edge-tts failure (per Henry's hard rule).
    }

    // ── gTTS (Google Translate fallback, free) ──
    // Henry 2026-06-04: GHS Standard fallback. Requires `pip install gtts` on the server.
    if (effectiveProvider === "gtts" || effectiveProvider === "google-translate") {
      const audioDir = path.join(env.storagePath, "audio", "tts");
      fs.mkdirSync(audioDir, { recursive: true });
      const outFile = path.join(audioDir, `tts_gtts_${Date.now()}.mp3`);
      const gttsLang = voiceId?.replace(/^gtts_/, "") || "en";
      try {
        await new Promise<void>((resolve, reject) => {
          const pyCode = `import sys; from gtts import gTTS; t = gTTS(text=sys.stdin.read(), lang='${gttsLang}'); t.save('${outFile.replace(/\\/g, "/")}')`;
          const proc = spawn("python3", ["-c", pyCode]);
          let stderr = "";
          proc.stderr?.on("data", c => { stderr += c.toString(); });
          proc.stdin.write(speakText);
          proc.stdin.end();
          const timer = setTimeout(() => { proc.kill(); reject(new Error(`gtts timeout`)); }, 60_000);
          proc.on("close", code => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`gtts exit ${code}: ${stderr.slice(0, 200)}`));
          });
          proc.on("error", e => { clearTimeout(timer); reject(e); });
        });
        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 500) {
          const url = `/api/media/audio/tts/${path.basename(outFile)}`;
          const durationMs = getAudioDurationMs(outFile, "mp3");
          console.log(`[tts.gtts] OK ${(durationMs/1000).toFixed(1)}s audio for ${speakText.length} chars, lang=${gttsLang}`);
          return NextResponse.json({ audioUrl: url, engine: "gtts", text: text.slice(0, 100), durationMs });
        }
      } catch (e) {
        console.error("[tts.gtts] FAILED:", e instanceof Error ? e.message : String(e));
      }
      // Fall through to Piper on any gtts failure.
    }

    // ── FAL voice models (F5-TTS / XTTS-v2 / Bark) — Henry 2026-06-04 ──
    // GHS Pro tier. Each is one branch with the FAL endpoint inferred from provider.
    // Falls through to Piper on any failure (per Henry's hard rule).
    const FAL_VOICE_ENDPOINTS: Record<string, string> = {
      "fal-f5":    "fal-ai/f5-tts",
      "fal-xtts":  "fal-ai/xtts-v2",
      "fal-bark":  "fal-ai/bark",
    };
    if (FAL_VOICE_ENDPOINTS[effectiveProvider] && process.env.FAL_KEY) {
      try {
        const endpoint = FAL_VOICE_ENDPOINTS[effectiveProvider];
        const falRes = await fetch(`https://fal.run/${endpoint}`, {
          method: "POST",
          headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: speakText, voice: voiceId || undefined, prompt: speakText }),
        });
        if (falRes.ok) {
          const data = await falRes.json() as { audio?: { url?: string }; audio_url?: string };
          const audioUrl = data.audio?.url || data.audio_url;
          if (audioUrl) {
            console.log(`[tts.${effectiveProvider}] OK url=${audioUrl.slice(0, 80)}`);
            return NextResponse.json({ audioUrl, engine: effectiveProvider, text: text.slice(0, 100) });
          }
          console.error(`[tts.${effectiveProvider}] no audio URL in response`);
        } else {
          console.error(`[tts.${effectiveProvider}] FAL status ${falRes.status}`);
        }
      } catch (e) {
        console.error(`[tts.${effectiveProvider}] FAILED:`, e instanceof Error ? e.message : String(e));
      }
      // Fall through to Piper.
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
    if (effectiveProvider === "elevenlabs" || effectiveProvider === "pro" || effectiveProvider === "fal-narrator" || effectiveProvider === "fal-narrator-gemini") {
      // Jump straight to requested provider — handled below
    } else try {
      // Henry 2026-05-30: route previously hard-coded ONE model path. Linux server has
      // models at /home/ghs/piper/voices/ but the legacy path was /home/ghs/giohomestudio/piper/.
      // Now: try PIPER_BIN + PIPER_VOICES_DIR env first, then a candidate list. First hit wins.
      const piperPath = process.env.PIPER_BIN || path.join(os.homedir(), "piper", "piper", "piper");
      const modelCandidates = [
        process.env.PIPER_VOICES_DIR ? path.join(process.env.PIPER_VOICES_DIR, "en_US-lessac-medium.onnx") : "",
        path.join(env.storagePath, "..", "piper", "en_US-lessac-medium.onnx"),
        path.join(os.homedir(), "piper", "voices", "en_US-lessac-medium.onnx"),
        path.join(os.homedir(), "piper", "en_US-lessac-medium.onnx"),
        "/usr/local/share/piper/voices/en_US-lessac-medium.onnx",
      ].filter(Boolean);
      const piperModel = modelCandidates.find(p => fs.existsSync(p)) || "";

      if (fs.existsSync(piperPath) && piperModel) {
        // Henry 2026-06-03: BIB regression fix. Long stories (5000+ chars) take
        // 60-120s+ for Piper to synthesize. Old hardcoded 30s timeout killed
        // Piper mid-synthesis -> threw -> silent catch hid the error -> dropped
        // to FAL or silent placeholder.
        //
        // New: timeout scales with text length. Floor 60s for short clips,
        // ceiling 10 min for huge stories. 2-byte-per-char-per-second budget
        // is generous on the server's CPU.
        const piperTimeoutMs = Math.max(60_000, Math.min(600_000, Math.ceil(speakText.length * 500)));
        console.log(`[tts.piper] text=${speakText.length} chars, timeout=${(piperTimeoutMs/1000).toFixed(0)}s, model=${path.basename(piperModel)}`);
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(piperPath, [
            "--model", piperModel,
            "--output_file", outFile,
            ...(speed ? ["--length_scale", String(1 / (speed || 1))] : []),
          ]);
          let stderr = "";
          proc.stderr?.on("data", chunk => { stderr += chunk.toString(); });
          // speakText = original with directive adverbs stripped (whispered/shouted/etc).
          // Piper has no emotion API, so cleaning the text is the most we can do.
          proc.stdin.write(speakText);
          proc.stdin.end();
          const timer = setTimeout(() => {
            proc.kill();
            reject(new Error(`Piper timeout after ${(piperTimeoutMs/1000).toFixed(0)}s on ${speakText.length} chars`));
          }, piperTimeoutMs);
          proc.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`Piper exit ${code}: ${stderr.slice(0, 200)}`));
          });
          proc.on("error", (e) => { clearTimeout(timer); reject(e); });
        });

        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
          const url = `/api/media/audio/tts/${path.basename(outFile)}`;
          const durationMs = getAudioDurationMs(outFile, "wav");
          console.log(`[tts.piper] OK ${(durationMs/1000).toFixed(1)}s audio for ${speakText.length} chars`);
          return NextResponse.json({ audioUrl: url, engine: "piper", text: text.slice(0, 100), durationMs });
        } else {
          console.error("[tts.piper] file missing or too small after Piper succeeded — model output empty?");
        }
      } else {
        console.warn(`[tts.piper] SKIPPED: piperBin=${fs.existsSync(piperPath)} model=${piperModel || "NONE"}`);
      }
    } catch (piperErr) {
      // Henry 2026-06-03: was silent catch (the BIB-recurrence bug). Now logs
      // EXPLICITLY so the next time narration silently goes BIB we know which
      // tier failed and why.
      console.error("[tts.piper] FAILED:", piperErr instanceof Error ? piperErr.message : String(piperErr));
    }

    // Try 2a: FAL Standard Narrator — fal-ai/kokoro american-english (smaller, fast)
    // Henry 2026-05-30 "BIB" fix: previously triggered only on provider="fal-narrator"
    // or "fal". When user picked "piper" and piper failed (binary/model missing on the
    // server), this block was SKIPPED → request fell straight through to ElevenLabs /
    // SAPI / silent-placeholder, producing the "BIB" beep narration users heard. Now
    // also trigger for provider="piper" since reaching this line with "piper" means
    // the piper attempt above already failed — FAL is a sensible fallback.
    const useFalNarrator = effectiveProvider === "fal-narrator" || effectiveProvider === "fal" || effectiveProvider === "piper";
    if (useFalNarrator && process.env.FAL_KEY) {
      try {
        // Migrated to providers/fal adapter (Henry 2026-05-30 task #25)
        const { falKokoroTts } = await import("@/lib/providers/fal");
        const falRes = await falKokoroTts({
          prompt: speakText,
          voice: voiceId || "af_sky",
          speed: speed || 1.0,
          variant: "american-english",
        });

        if (!falRes.ok) {
          console.error(`FAL Standard Narrator TTS failed ${falRes.status}:`, falRes.error.slice(0, 200));
          throw new Error(`FAL Standard Narrator ${falRes.status}: ${falRes.error.slice(0, 200)}`);
        }

        const falData = (falRes.raw as { audio_url?: string; audio?: { url?: string } }) || {};
        const falAudioUrl = falData.audio_url || falData.audio?.url;
        if (falAudioUrl) {
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
        console.error("FAL Standard Narrator TTS failed:", JSON.stringify(err instanceof Error ? err.message : err));
        if (effectiveProvider === "fal-narrator" || effectiveProvider === "fal") {
          return NextResponse.json({ error: err instanceof Error ? err.message : "FAL Standard Narrator failed" }, { status: 500 });
        }
      }
    }

    // Try 2b: FAL Pro Narrator — fal-ai/kokoro (full model, higher quality)
    // Triggers when provider="fal-narrator-gemini"
    const useFalNarratorPro = effectiveProvider === "fal-narrator-gemini";
    if (useFalNarratorPro && process.env.FAL_KEY) {
      try {
        // Migrated to providers/fal adapter (Henry 2026-05-30 task #25)
        const { falKokoroTts } = await import("@/lib/providers/fal");
        const falRes = await falKokoroTts({
          prompt: speakText,
          voice: voiceId || "af_sky",
          speed: speed || 1.0,
          variant: "global",
        });

        if (!falRes.ok) {
          console.error(`FAL Pro Narrator TTS failed ${falRes.status}:`, falRes.error.slice(0, 200));
          throw new Error(`FAL Pro Narrator ${falRes.status}: ${falRes.error.slice(0, 200)}`);
        }

        const falData = (falRes.raw as { audio_url?: string; audio?: { url?: string } }) || {};
        const falAudioUrl = falData.audio_url || falData.audio?.url;
        if (falAudioUrl) {
          const falAudioRes = await fetch(falAudioUrl);
          if (falAudioRes.ok) {
            const mp3File = outFile.replace(".wav", "_fal_pro.mp3");
            const buffer = Buffer.from(await falAudioRes.arrayBuffer());
            fs.writeFileSync(mp3File, buffer);
            const url = `/api/media/audio/tts/${path.basename(mp3File)}`;
            const durationMs = getAudioDurationMs(mp3File, "mp3");
            return NextResponse.json({ audioUrl: url, engine: "fal-narrator-pro", text: text.slice(0, 100), durationMs });
          }
        }
      } catch (err) {
        console.error("FAL Pro Narrator TTS failed:", JSON.stringify(err instanceof Error ? err.message : err));
        return NextResponse.json({ error: err instanceof Error ? err.message : "FAL Pro Narrator failed" }, { status: 500 });
      }
    }

    // Try 3: ElevenLabs — premium quality, explicit error surfacing (no silent swallow)
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const vid = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah
        // Emotion → voice_settings tweak. Same voice identity, different inflection.
        const settings = elevenLabsSettingsFor(finalEmotion);
        // If ELEVENLABS_USE_V3=true the caller wants the v3 multi-speaker model which
        // honours <emotion> tags inline. Otherwise we use v1 + emotion-tuned voice_settings.
        const useV3 = process.env.ELEVENLABS_USE_V3 === "true";
        const modelId = useV3 ? "eleven_v3" : "eleven_monolingual_v1";
        const v3Text = useV3 && finalEmotion !== "neutral"
          ? `<${finalEmotion}>${speakText}</${finalEmotion}>`
          : speakText;
        const elevenLabsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: v3Text,
            model_id: modelId,
            voice_settings: settings,
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
        return NextResponse.json({ audioUrl: url, engine: useV3 ? "elevenlabs-v3" : "elevenlabs", text: speakText.slice(0, 100), emotion: finalEmotion, durationMs });
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
