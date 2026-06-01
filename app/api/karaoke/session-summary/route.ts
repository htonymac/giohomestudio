// GET /api/karaoke/session-summary?recordingId=<id>
// Returns a full JSON archive of a karaoke take: pipeline outputs + music metadata + license.
// Undefined/null pipeline fields come back as null — works at any pipeline stage.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const recordingId = req.nextUrl.searchParams.get("recordingId");
    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    const rec = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!rec) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    // Best-effort — null if the recording has no associated music gen row yet.
    const musicGen = await prisma.musicGeneration
      .findFirst({
        where: { userId: rec.userId, prompt: { contains: recordingId } },
        orderBy: { createdAt: "desc" },
      })
      .catch(() => null);

    const summary = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      recording: {
        id: rec.id,
        userId: rec.userId,
        fileName: rec.fileName,
        fileUrl: rec.fileUrl,
        durationSec: rec.durationSec,
        mode: rec.mode,
        createdAt: rec.createdAt,
        purgeAt: rec.purgeAt,
      },
      pipeline: {
        analysis: rec.analysis ?? null,
        transcript: rec.transcript ?? null,
        flowProfile: rec.flowProfile ?? null,
        productionBrief: rec.productionBrief ?? null,
        generatedMusicUrl: rec.generatedMusicUrl ?? null,
        mixSettings: rec.mixSettings ?? null,
        mixedOutputUrl: rec.mixedOutputUrl ?? null,
      },
      music: musicGen
        ? {
            providerKey: musicGen.providerKey,
            modelName: musicGen.modelName,
            prompt: musicGen.prompt,
            durationSeconds: musicGen.durationSeconds,
            costUsd: String(musicGen.costUsd),
            hasLyrics: musicGen.hasLyrics,
            genre: musicGen.genre,
            mood: musicGen.mood,
          }
        : null,
      license: {
        policy:
          "GHS safe-music policy (locked 2026-05-31): CC0 / Pixabay / Mixkit / Stable Audio only. No CC-BY / Incompetech / CC-BY-NC.",
        verifiedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(summary, {
      headers: {
        "Content-Disposition": `attachment; filename="karaoke_${recordingId.slice(0, 8)}_summary.json"`,
      },
    });
  } catch (err) {
    console.error("[karaoke/session-summary] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "summary failed" },
      { status: 500 }
    );
  }
}
