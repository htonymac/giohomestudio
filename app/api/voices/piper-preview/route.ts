// POST /api/voices/piper-preview
// Generates a short voice demo using Piper TTS (local, free).
// Returns audio/mpeg stream.

import { NextRequest, NextResponse } from "next/server";
import { piperVoiceProvider } from "@/modules/voice-provider/piper";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = (body.text as string)?.trim() || "Welcome to GioHomeStudio. This is a voice preview demo.";
  const voiceId = (body.voiceId as string) || undefined;

  const previewDir = path.resolve("storage", "previews");
  fs.mkdirSync(previewDir, { recursive: true });
  const outputPath = path.join(previewDir, `piper_preview_${Date.now()}.mp3`);

  const result = await piperVoiceProvider.generate({
    text,
    voiceId,
    outputPath,
  });

  if (result.status !== "completed" || !result.localPath) {
    return NextResponse.json(
      { error: result.error ?? "Piper TTS not available. Install: pip install piper-tts" },
      { status: 503 }
    );
  }

  const buf = fs.readFileSync(result.localPath);
  // Clean up preview file after reading
  try { fs.unlinkSync(result.localPath); } catch { /* ok */ }

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buf.length),
    },
  });
}

// GET /api/voices/piper-preview — list available Piper voices
export async function GET() {
  const voices = await piperVoiceProvider.listVoices();
  return NextResponse.json({ voices });
}
