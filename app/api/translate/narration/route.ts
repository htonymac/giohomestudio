// POST /api/translate/narration
// Translates narration text to target language AND regenerates TTS audio
// Returns { original, translated, audioUrl } or error
// Uses callPlanner from model-tier-router for translation, then Piper/ElevenLabs for TTS

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { env } from "@/config/env";

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "French", es: "Spanish", pt: "Portuguese", de: "German",
  it: "Italian", nl: "Dutch", pl: "Polish", ru: "Russian",
  zh: "Mandarin Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", yo: "Yoruba", ha: "Hausa",
  ig: "Igbo", sw: "Swahili", pcm: "Nigerian Pidgin English",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, targetLanguage, voiceId, sceneId } = body;

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "text and targetLanguage required" }, { status: 400 });
    }

    const langLabel = LANGUAGE_LABELS[targetLanguage] ?? targetLanguage;

    // Step 1: Translate text
    const translateResult = await callLLM(
      `Translate the following narration text to ${langLabel}. Output ONLY the translated text. Preserve emotional tone and pacing marks.\n\nText:\n${text}`,
      `You are a professional narrator translator. Preserve tone, emphasis, and natural speech rhythm for TTS.`,
      { role: "fast", temperature: 0.3, maxTokens: 2500, timeoutMs: 20000 }
    );

    const translated = translateResult.ok ? translateResult.text.trim() : text;

    // Step 2: Generate TTS audio from translated text
    let audioUrl: string | null = null;

    // Try Piper TTS first (free, local)
    try {
      const piperPath = process.env.PIPER_BIN || path.join(os.homedir(), "piper", "piper");
      const piperModel = path.join(env.storagePath, "..", "piper", "en_US-lessac-medium.onnx");

      if (fs.existsSync(piperPath) && fs.existsSync(piperModel)) {
        const audioDir = path.join(env.storagePath, "audio", "narration");
        fs.mkdirSync(audioDir, { recursive: true });
        const outFile = path.join(audioDir, `translated_${sceneId || Date.now()}_${targetLanguage}.wav`);

        await new Promise<void>((resolve, reject) => {
          const proc = spawn(piperPath, ["--model", piperModel, "--output_file", outFile]);
          proc.stdin.write(translated);
          proc.stdin.end();
          const timer = setTimeout(() => { proc.kill(); reject(new Error("Piper timeout")); }, 30000);
          proc.on("close", () => { clearTimeout(timer); resolve(); });
          proc.on("error", (e) => { clearTimeout(timer); reject(e); });
        });

        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
          audioUrl = `/api/media/audio/narration/${path.basename(outFile)}`;
        }
      }
    } catch { /* Piper failed */ }

    // Try ElevenLabs fallback
    if (!audioUrl && process.env.ELEVENLABS_API_KEY) {
      try {
        const vid = voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah default
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: translated,
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });

        if (res.ok) {
          const audioDir = path.join(env.storagePath, "audio", "narration");
          fs.mkdirSync(audioDir, { recursive: true });
          const outFile = path.join(audioDir, `translated_${sceneId || Date.now()}_${targetLanguage}.mp3`);
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(outFile, buffer);
          audioUrl = `/api/media/audio/narration/${path.basename(outFile)}`;
        }
      } catch { /* ElevenLabs failed */ }
    }

    return NextResponse.json({
      original: text,
      translated,
      targetLanguage,
      audioUrl,
      usedFallback: !translateResult.ok,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Translation failed" }, { status: 500 });
  }
}
