// POST /api/karaoke/save-mix
// Body: { recordingId: string, mixSettings: object }
// Saves mix settings JSON to KaraokeRecording.mixSettings

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId, mixSettings } = body;

    if (!recordingId || !mixSettings) {
      return NextResponse.json({ error: "recordingId and mixSettings are required" }, { status: 400 });
    }

    const recording = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { mixSettings: mixSettings as object },
    });

    return NextResponse.json({ success: true, recordingId });
  } catch (err) {
    console.error("[karaoke/save-mix] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save mix failed" },
      { status: 500 }
    );
  }
}
