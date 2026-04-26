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
