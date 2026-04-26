// GHS Voice Pro — Gemini Flash TTS via fal.ai
// GHS branding: "GHS Voice Pro" — never show "Gemini" in UI
// Supports single-speaker and multi-speaker dialogue in one call.

import { NextRequest, NextResponse } from "next/server";
import { generateSpeechGemini } from "@/lib/generation/gateways/fal";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice, language, speakers } = body;

    if (!text && !speakers?.length) {
      return NextResponse.json({ error: "text or speakers required" }, { status: 400 });
    }

    const result = await generateSpeechGemini(text || "", { voice, language, speakers });

    return NextResponse.json({
      ok: true,
      audioUrl: result.audioUrl,
      contentType: result.contentType,
      provider: "GHS Voice Pro",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GHS Voice Pro] Gemini TTS error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
