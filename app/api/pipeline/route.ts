// GioHomeStudio — POST /api/pipeline
// Starts the Phase 1 generation pipeline.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/core/pipeline";
import { createContentItem } from "@/modules/content-registry";
import { SPEECH_STYLE_VALUES, ELEVENLABS_MODELS } from "@/types/providers";

const schema = z.object({
  rawInput: z.string().min(3, "Input must be at least 3 characters"),
  durationSeconds: z.number().min(3).max(60).optional(),
  voiceId: z.string().optional(),
  voiceLanguage: z.string().optional(),
  voiceModel: z.enum(ELEVENLABS_MODELS).optional(),
  requestedVoiceProvider: z.enum(["elevenlabs", "mock_voice"]).optional(),
  narrationSpeed: z.number().min(0.7).max(1.2).optional(),
  narrationVolume: z.number().min(0).max(1).optional(),
  outputMode: z.enum(["text_to_video", "text_to_audio", "video_to_video", "images_audio", "hybrid", "image_to_video"]).optional(),
  audioMode: z.enum(["voice_music", "voice_only", "music_only", "audio_only"]).optional(),
  castingCharacters: z.array(z.string()).optional(),
  speechStyle: z.enum(SPEECH_STYLE_VALUES).optional(),
  musicMood: z.string().optional(),
  musicProvider: z.enum(["stock_library", "mock_music"]).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  musicGenre: z.enum(["cinematic", "electronic", "acoustic", "orchestral", "ambient", "hip_hop"]).optional(),
  musicRegion: z.enum(["global", "western", "latin", "asian", "middle_eastern", "african"]).optional(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional(),
  destinationPageId: z.string().optional(),
  videoProvider: z.enum(["runway", "kling", "mock_video"]).optional(),
  videoQuality: z.enum(["draft", "standard", "high"]).optional(),
  videoType: z.enum(["cinematic", "ad_promo", "realistic", "animation", "storytelling", "social_short"]).optional(),
  visualStyle: z.enum(["photorealistic", "stylized", "anime", "3d", "cinematic_dark", "bright_commercial"]).optional(),
  subjectType: z.enum(["human", "animal", "product", "scene_only", "custom_character"]).optional(),
  customSubjectDescription: z.string().max(200).optional(),
  aiAutoMode: z.boolean().optional(),
  castingEthnicity: z.enum(["african", "black", "white", "asian", "arab", "mixed"]).optional(),
  castingGender: z.enum(["male", "female", "nonbinary", "mixed_gender"]).optional(),
  castingAge: z.enum(["child", "teen", "young_adult", "adult", "senior"]).optional(),
  castingCount: z.enum(["solo", "duo", "group", "crowd"]).optional(),
  cultureContext: z.enum(["african", "arab", "asian", "latin", "western", "global"]).optional(),
  referenceImageUrl: z.string().max(500).optional(),
  imageActionPrompt: z.string().max(300).optional(),
  sourceVideoPath: z.string().optional(),
  storyContext: z.string().max(1000).optional(),
  previousContentItemId: z.string().optional(),
  storyThreadId: z.string().optional(),
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
      requestedVoiceProvider: parsed.data.requestedVoiceProvider,
      narrationSpeed: parsed.data.narrationSpeed,
      narrationVolume: parsed.data.narrationVolume,
      outputMode: parsed.data.outputMode,
      audioMode: parsed.data.audioMode,
      castingCharacters: parsed.data.castingCharacters,
      requestedMusicProvider: parsed.data.musicProvider,
      musicVolume: parsed.data.musicVolume,
      aspectRatio: parsed.data.aspectRatio ?? "9:16",
      musicGenre: parsed.data.musicGenre,
      musicRegion: parsed.data.musicRegion,
      castingEthnicity: parsed.data.castingEthnicity,
      castingGender: parsed.data.castingGender,
      castingAge: parsed.data.castingAge,
      castingCount: parsed.data.castingCount,
      cultureContext: parsed.data.cultureContext,
      referenceImageUrl: parsed.data.referenceImageUrl,
      storyContext: parsed.data.storyContext,
      previousContentItemId: parsed.data.previousContentItemId,
      storyThreadId: parsed.data.storyThreadId,
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
