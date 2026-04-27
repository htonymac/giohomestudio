// GET /api/karaoke/list
// Returns last N KaraokeRecording rows for the current user (or "anonymous")
// Query: ?userId=xxx (optional, defaults to "anonymous")
// Query: ?limit=N (optional, defaults to 20)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") || "anonymous";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const take = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    const recordings = await prisma.karaokeRecording.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        durationSec: true,
        transcript: true,
        createdAt: true,
        analysis: true,
        mode: true,
        flowProfile: true,
        productionBrief: true,
        generatedMusicUrl: true,
        mixedOutputUrl: true,
        exportedFiles: true,
      },
    });

    return NextResponse.json({ recordings });
  } catch (err) {
    console.error("[karaoke/list] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "List failed" },
      { status: 500 }
    );
  }
}
