// GioHomeStudio — POST /api/voice-design/generate
// Saves a chosen voice design preview to Henry's ElevenLabs voice library and returns the voiceId.

import { NextRequest, NextResponse } from "next/server";
import { voiceDesignGenerate } from "@/modules/voice-provider/elevenlabs/voice-design";

export async function POST(req: NextRequest) {
  let body: { previewId?: string; voiceName?: string; voiceDescription?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { previewId, voiceName, voiceDescription } = body;
  if (!previewId || !voiceName) {
    return NextResponse.json({ error: "Missing required fields: previewId, voiceName" }, { status: 400 });
  }

  try {
    const result = await voiceDesignGenerate(
      previewId,
      voiceName,
      voiceDescription ?? voiceName
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
