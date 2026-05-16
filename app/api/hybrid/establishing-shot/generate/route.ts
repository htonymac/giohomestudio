// app/api/hybrid/establishing-shot/generate/route.ts
// POST { sceneId, shot: EstablishingShot, provider? }
// → generates a wide establishing shot image via FAL FLUX
// → returns { imageUrl }

import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/generation/selectors/image-provider";

// Establishing shot types — mirrors hybrid-planner EstablishingShot interface
export interface EstablishingShot {
  type: "opening" | "location" | "transition" | "mood" | "pre_action" | "exterior_building" | "aerial" | "beauty";
  prompt: string;
  durationSeconds: number;
  cameraMovement?: string;
  mood?: string;
  purpose?: string;
  location?: string;
  timeOfDay?: string;
}

interface GenerateBody {
  sceneId: string;
  shot: EstablishingShot;
  provider?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateBody = await req.json();
    const { sceneId, shot, provider } = body;

    if (!sceneId || !shot?.prompt) {
      return NextResponse.json(
        { error: "Missing required fields: sceneId, shot.prompt" },
        { status: 400 }
      );
    }

    // Build wide establishing shot prompt — prepend required prefix
    const cameraNote = shot.cameraMovement ? `, ${shot.cameraMovement}` : "";
    const moodNote = shot.mood ? `, ${shot.mood} mood` : "";
    const timeNote = shot.timeOfDay ? `, ${shot.timeOfDay}` : "";
    const locationNote = shot.location ? `, ${shot.location}` : "";

    const fullPrompt = [
      "Wide establishing shot",
      shot.prompt.trim(),
      cameraNote ? cameraNote.trim() : null,
      moodNote ? moodNote.trim() : null,
      timeNote ? timeNote.trim() : null,
      locationNote ? locationNote.trim() : null,
      "cinematic, high detail, sharp focus, professional photography",
    ]
      .filter(Boolean)
      .join(", ");

    // Negative prompt — common for establishing/wide shots
    const negativePrompt =
      "close-up face, portrait, people in foreground, text, watermark, blurry, low quality, duplicate";

    // Use wide aspect ratio (1280×720) for establishing shots
    const result = await generateImage({
      modelId: provider === "flux-pro" ? "fal_flux_pro" : "fal_flux_dev",
      prompt: fullPrompt,
      negativePrompt,
      width: 1280,
      height: 720,
    });

    if (!result.success || (!result.imageUrl && !result.imagePath)) {
      return NextResponse.json(
        { error: result.error ?? "Image generation failed" },
        { status: 500 }
      );
    }

    const imageUrl = result.imageUrl ?? result.imagePath ?? "";

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("[establishing-shot/generate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
