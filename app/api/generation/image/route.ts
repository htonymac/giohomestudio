// POST /api/generation/image — generate an image using the provider source layer
import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { z } from "zod";
import { env } from "@/config/env";
import { generateImage } from "@/lib/generation/selectors/image-provider";

const schema = z.object({
  modelId: z.string().optional(),
  prompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  seed: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const outputPath = path.join(env.storagePath, "images", `gen_${Date.now()}.png`);

  const result = await generateImage({
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

  // Auto-save to asset library for reuse across modes
  if (result.imagePath) {
    try {
      const assetRes = await fetch(new URL("/api/assets", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          name: parsed.data.prompt.slice(0, 60),
          description: parsed.data.prompt,
          filePath: result.imagePath,
          tags: ["generated", result.model.provider_name],
          source: "generated",
          provider: result.model.provider_name,
        }),
      });
    } catch { /* asset save is best-effort */ }
  }

  return NextResponse.json({
    imagePath: result.imagePath,
    imageUrl: result.imageUrl,
    model: result.model.id,
    provider: result.model.provider_name,
    displayName: result.model.display_name,
  });
}
