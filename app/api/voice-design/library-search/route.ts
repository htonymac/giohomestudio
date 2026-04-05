// GioHomeStudio — GET /api/voice-design/library-search?query=nigerian
// Searches ElevenLabs Voice Library for African/Nigerian/Ghanaian/South African voices.

import { NextRequest, NextResponse } from "next/server";
import { searchVoiceLibrary } from "@/modules/voice-provider/elevenlabs/voice-design";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") ?? "nigerian";

  try {
    const result = await searchVoiceLibrary(query);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
