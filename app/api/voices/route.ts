// GioHomeStudio — GET /api/voices
// Returns available ElevenLabs voices. Falls back to a hardcoded default list
// if ElevenLabs is not configured or the API call fails.

import { NextResponse } from "next/server";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";

// Hardcoded fallback list — premade ElevenLabs voices available on free tier
const FALLBACK_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (default)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
];

export async function GET() {
  try {
    const voices = await elevenLabsVoiceProvider.listVoices();

    if (voices.length > 0) {
      return NextResponse.json({ voices, source: "elevenlabs" });
    }

    // ElevenLabs returned empty (key not set or API error)
    return NextResponse.json({ voices: FALLBACK_VOICES, source: "fallback" });
  } catch {
    return NextResponse.json({ voices: FALLBACK_VOICES, source: "fallback" });
  }
}
