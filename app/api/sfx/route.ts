// GET /api/sfx — list all SFX files and which ones are available (file exists)

import { NextResponse } from "next/server";
import { SFX_LIBRARY, listAvailableSFX } from "@/modules/sfx";

export async function GET() {
  const available = listAvailableSFX().map(s => s.event);
  const library = SFX_LIBRARY.map(s => ({
    ...s,
    available: available.includes(s.event),
  }));
  return NextResponse.json({ library, availableCount: available.length, totalCount: SFX_LIBRARY.length });
}
