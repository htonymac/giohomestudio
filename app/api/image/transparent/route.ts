// Ideogram V3 Transparent Background Generation
// Generates PNG images with fully transparent background — no background removal needed.
// Used across all 5 planners when user checks "Transparent Background" option.

import { NextRequest, NextResponse } from "next/server";
import { generateTransparent } from "@/lib/generation/gateways/fal";

export async function POST(req: NextRequest) {
  try {
    const { prompt, image_size, rendering_speed, magic_prompt, seed } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const result = await generateTransparent(prompt, {
      image_size: image_size || "square_hd",
      rendering_speed: rendering_speed || "BALANCED",
      magic_prompt: magic_prompt || "AUTO",
      seed,
    });

    return NextResponse.json({
      ok: true,
      imageUrl: result.imageUrl,
      fileName: result.fileName,
      seed: result.seed,
      transparent: true,
      outputFormat: "PNG",
      tags: ["transparent-background", "png-cutout"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Transparent Image] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
