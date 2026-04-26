// POST /api/pipeline/retry — Re-trigger pipeline for a PENDING or FAILED item
// This allows recovery of items that got stuck when the server was restarted.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPipeline } from "@/core/pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { contentItemId } = body;

    if (!contentItemId) {
      return NextResponse.json({ error: "contentItemId required" }, { status: 400 });
    }

    const item = await prisma.contentItem.findUnique({ where: { id: contentItemId } });
    if (!item) {
      return NextResponse.json({ error: "Content item not found" }, { status: 404 });
    }

    if (item.status !== "PENDING" && item.status !== "FAILED") {
      return NextResponse.json({
        error: `Cannot retry item with status: ${item.status}. Only PENDING or FAILED items can be retried.`,
      }, { status: 400 });
    }

    // Reset to PENDING and re-run
    await prisma.contentItem.update({ where: { id: contentItemId }, data: { status: "PENDING", notes: null } });

    // Fire pipeline in background
    runPipeline({
      rawInput: item.originalInput,
      contentItemId: item.id,
      mode: "FREE",
      durationSeconds: item.durationSeconds ?? undefined,
      outputMode: (item.outputMode as "text_to_video" | "text_to_audio" | "video_to_video" | "images_audio" | "hybrid" | "image_to_video") ?? "text_to_video",
      aspectRatio: (item.aspectRatio as "9:16" | "16:9" | "1:1") ?? "9:16",
      voiceId: item.voiceId ?? undefined,
      voiceLanguage: item.voiceLanguage ?? undefined,
      videoProvider: (item.requestedVideoProvider as "runway" | "kling" | "mock_video") ?? undefined,
      videoQuality: (item.videoQuality as "draft" | "standard" | "high") ?? undefined,
      aiAutoMode: item.aiAutoMode ?? true,
      musicMood: undefined,
      castingCharacters: (item.castingCharacters as string[]) ?? undefined,
      destinationPageId: item.destinationPageId ?? undefined,
    }).catch((err) => console.error("[pipeline/retry] Background error:", err));

    return NextResponse.json({ message: "Pipeline retry started", contentItemId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
