import { NextRequest, NextResponse } from "next/server";
import { buildStoryContract } from "@/lib/story-supervisors/story-contract";
import type {
  StoryType,
  LanguageLevel,
  EmotionalIntensity,
  SubtitleStyle,
  GenerationMode,
} from "@/lib/story-supervisors/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      storyId,
      country = "General",
      culture = "general",
      storyType = "short_story",
      targetDuration = "60s",
      sceneDurationSeconds = 5,
      languageLevel = "normal_english",
      emotionalIntensity = "normal",
      subtitleStyle = "normal_movie",
      generationMode = "hybrid",
      targetAudience = "general",
      nameStyle,
    } = body;

    if (!storyId) {
      return NextResponse.json({ error: "storyId is required" }, { status: 400 });
    }

    const contract = buildStoryContract({
      storyId,
      country,
      culture,
      storyType: storyType as StoryType,
      targetDuration: String(targetDuration),
      sceneDurationSeconds: Number(sceneDurationSeconds),
      languageLevel: languageLevel as LanguageLevel,
      emotionalIntensity: emotionalIntensity as EmotionalIntensity,
      subtitleStyle: subtitleStyle as SubtitleStyle,
      generationMode: generationMode as GenerationMode,
      targetAudience,
      nameStyle: nameStyle || undefined,
    });

    return NextResponse.json({ contract });
  } catch (err) {
    console.error("generate-contract error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
