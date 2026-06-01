// POST /api/karaoke/mix-over-beat — Free Mode pick-a-beat pipeline (T1-B)
// Thin wrapper around src/lib/karaoke/beat-mixer.ts. Resolves recordingId →
// vocal disk path and beatUrl → beat disk path, calls the helper, stores the
// mixed output URL on KaraokeRecording.mixedOutputUrl, returns the URL.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { mixVocalOverBeat } from "@/lib/karaoke/beat-mixer";
import * as path from "path";

function urlToDiskPath(url: string): string | null {
  const m = url.match(/^\/api\/media\/(.+)$/);
  if (!m) return null;
  return path.join(env.storagePath, m[1]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const recordingId = String(body.recordingId || "").trim();
    const beatUrl = String(body.beatUrl || "").trim();
    if (!recordingId || !beatUrl) {
      return NextResponse.json({ error: "recordingId and beatUrl required" }, { status: 400 });
    }
    const recording = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!recording) return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });

    const vocalDiskPath = urlToDiskPath(recording.fileUrl);
    const beatDiskPath = urlToDiskPath(beatUrl);
    if (!vocalDiskPath || !beatDiskPath) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    const outDir = path.join(env.storagePath, "karaoke", "free-mix", recordingId);
    const result = await mixVocalOverBeat(
      vocalDiskPath, beatDiskPath, outDir,
      typeof body.vocalVolume === "number" ? body.vocalVolume : 1.0,
      typeof body.beatVolume === "number" ? body.beatVolume : 0.5,
    );

    if (!result.ok || !result.mixedPath) {
      return NextResponse.json({ error: result.error || "mix failed" }, { status: 500 });
    }
    const mixedUrl = `/api/media/karaoke/free-mix/${recordingId}/${path.basename(result.mixedPath)}`;
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { mixedOutputUrl: mixedUrl },
    });

    return NextResponse.json({ ok: true, mixedUrl, durationSec: result.durationSec ?? null });
  } catch (err) {
    console.error("[karaoke/mix-over-beat] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "mix failed" },
      { status: 500 }
    );
  }
}
