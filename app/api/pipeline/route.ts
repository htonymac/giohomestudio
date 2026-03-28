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
  voiceLanguage: z.string().optional(),
  musicMood: z.string().optional(),
  musicProvider: z.enum(["stock_library", "mock_music"]).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional(),
  destinationPageId: z.string().optional(),
  videoProvider: z.enum(["runway", "kling", "mock_video"]).optional(),
  videoQuality: z.enum(["draft", "standard", "high"]).optional(),
  videoType: z.enum(["cinematic", "ad_promo", "realistic", "animation", "storytelling", "social_short"]).optional(),
  visualStyle: z.enum(["photorealistic", "stylized", "anime", "3d", "cinematic_dark", "bright_commercial"]).optional(),
  subjectType: z.enum(["human", "animal", "product", "scene_only", "custom_character"]).optional(),
  customSubjectDescription: z.string().max(200).optional(),
  aiAutoMode: z.boolean().optional(),
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
      requestedVideoProvider: parsed.data.videoProvider,
      videoQuality: parsed.data.videoQuality,
      videoType: parsed.data.videoType,
      visualStyle: parsed.data.visualStyle,
      subjectType: parsed.data.subjectType,
      customSubjectDescription: parsed.data.customSubjectDescription,
      aiAutoMode: parsed.data.aiAutoMode,
      voiceId: parsed.data.voiceId,
      voiceLanguage: parsed.data.voiceLanguage,
      requestedMusicProvider: parsed.data.musicProvider,
      musicVolume: parsed.data.musicVolume,
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
