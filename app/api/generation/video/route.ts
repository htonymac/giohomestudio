// POST /api/generation/video — generate a video using the provider source layer
import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { z } from "zod";
import { env } from "@/config/env";
import { generateVideo } from "@/lib/generation/selectors/video-provider";

const schema = z.object({
  modelId: z.string().optional(),
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  duration: z.number().min(1).max(30).optional(),
  imageUrl: z.string().url().optional(),
  seed: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // Kill-switch check — H10 of 12-hour run.
  // Per-provider: FAL_VIDEO / KLING_DIRECT / MUAPI_VIDEO / RUNWAY_DIRECT.
  // modelId prefix selects the gate. Unknown prefix fails open.
  try {
    const { isFlagEnabled, flagDisabledResponse } = await import("@/lib/feature-flags");
    const m = parsed.data.modelId ?? "";
    if (/^fal[_-]/i.test(m) && !(await isFlagEnabled("FLAG_FAL_VIDEO"))) {
      return flagDisabledResponse("FAL video generation");
    }
    if (/^kling[_-]direct/i.test(m) && !(await isFlagEnabled("FLAG_KLING_DIRECT"))) {
      return flagDisabledResponse("Kling Direct video generation");
    }
    if (/^muapi/i.test(m) && !(await isFlagEnabled("FLAG_MUAPI_VIDEO"))) {
      return flagDisabledResponse("MuAPI video generation");
    }
    if (/^runway[_-]direct/i.test(m) && !(await isFlagEnabled("FLAG_RUNWAY_DIRECT"))) {
      return flagDisabledResponse("Runway Direct video generation");
    }
  } catch { /* flag check best-effort, fail open */ }

  const outputPath = path.join(env.storagePath, "video", `gen_${Date.now()}.mp4`);

  const result = await generateVideo({
    ...parsed.data,
    outputPath,
  });

  if (!result.success) {
    return NextResponse.json({
      error: result.error,
      model: result.model.id,
      provider: result.model.provider_name,
    }, { status: 502 });
  }

  return NextResponse.json({
    videoPath: result.videoPath,
    videoUrl: result.videoUrl,
    model: result.model.id,
    provider: result.model.provider_name,
    displayName: result.model.display_name,
  });
}
