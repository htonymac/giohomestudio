// POST /api/karaoke/rename — update displayed fileName for a take
// Body: { recordingId: string, fileName: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const recordingId = String(body.recordingId || "").trim();
    const fileName = String(body.fileName || "").trim();
    if (!recordingId) return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });
    if (fileName.length > 120) return NextResponse.json({ error: "fileName too long (>120 chars)" }, { status: 400 });

    const recording = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!recording) return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });

    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { fileName },
    });

    return NextResponse.json({ ok: true, recordingId, fileName });
  } catch (err) {
    console.error("[karaoke/rename] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rename failed" },
      { status: 500 }
    );
  }
}
