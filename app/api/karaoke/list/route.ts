// GET /api/karaoke/list
// Returns last 20 KaraokeRecording rows for the current user (or "anonymous")
// Query: ?userId=xxx (optional, defaults to "anonymous")

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") || "anonymous";

    const recordings = await prisma.karaokeRecording.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        durationSec: true,
        transcript: true,
        createdAt: true,
        analysis: true,
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
