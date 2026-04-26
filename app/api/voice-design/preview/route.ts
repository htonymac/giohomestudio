// GioHomeStudio — POST /api/voice-design/preview
// Accepts accent profile settings, calls ElevenLabs Voice Design API, returns 3 preview variations.

import { NextRequest, NextResponse } from "next/server";
import { buildVoiceDesignPrompt } from "@/modules/voice-provider/accent-profiles";
import { voiceDesignPreview } from "@/modules/voice-provider/elevenlabs/voice-design";
import type { NarrationSettings } from "@/modules/voice-provider/accent-profiles";

export async function POST(req: NextRequest) {
  let body: Partial<NarrationSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { locale, speakerProfile, deliveryStyle, pacing, emotion, customInstruction } = body;
  if (!locale || !speakerProfile || !deliveryStyle || !pacing || !emotion) {
    return NextResponse.json({ error: "Missing required fields: locale, speakerProfile, deliveryStyle, pacing, emotion" }, { status: 400 });
  }

  const settings: NarrationSettings = {
    locale,
    speakerProfile,
    deliveryStyle,
    pacing,
    emotion,
    customInstruction: customInstruction ?? "",
    voiceSource: "auto_design",
  };

  try {
    const prompt = buildVoiceDesignPrompt(settings);
    const result = await voiceDesignPreview(prompt, locale);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
