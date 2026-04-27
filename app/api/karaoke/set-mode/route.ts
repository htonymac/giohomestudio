// POST /api/karaoke/set-mode
// Body: { recordingId: string, mode: "A"|"B"|"C"|"D"|"E" }
// Saves mode to KaraokeRecording.mode field.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_MODES = new Set(["A", "B", "C", "D", "E"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId, mode } = body;

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }
    if (!mode || !VALID_MODES.has(mode)) {
      return NextResponse.json({ error: "mode must be A | B | C | D | E" }, { status: 400 });
    }

    const recording = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { mode },
    });

    return NextResponse.json({ recordingId, mode });
  } catch (err) {
    console.error("[karaoke/set-mode] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Set mode failed" },
      { status: 500 }
    );
  }
}
