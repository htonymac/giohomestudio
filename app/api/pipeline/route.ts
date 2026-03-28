// GioHomeStudio — POST /api/pipeline
// Starts the Phase 1 generation pipeline.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/core/pipeline";
import { createContentItem } from "@/modules/content-registry";

const schema = z.object({
  rawInput: z.string().min(3, "Input must be at least 3 characters"),
  durationSeconds: z.number().min(3).max(60).optional(),
  voiceId: z.string().optional(),
  musicMood: z.string().optional(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional(),
  destinationPageId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Create the content item synchronously so we can return its ID immediately
    const contentItem = await createContentItem({
      originalInput: parsed.data.rawInput,
      mode: "FREE",
      durationSeconds: parsed.data.durationSeconds,
      destinationPageId: parsed.data.destinationPageId,
    });

    // Fire pipeline in background — passes pre-created ID so pipeline skips re-creation
    runPipeline({ ...parsed.data, mode: "FREE", contentItemId: contentItem.id }).catch((err) =>
      console.error("[API /pipeline] Background pipeline error:", err)
    );

    return NextResponse.json(
      { contentItemId: contentItem.id, message: "Pipeline started. Poll /api/registry/:id for status." },
      { status: 202 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
