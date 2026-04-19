// Ideogram V3 Layerize Text API
// Extracts editable text layers from an existing image.
// After this call, all text edits and preview re-compositing are FREE (no API call).

import { NextRequest, NextResponse } from "next/server";
import { layerizeText } from "@/lib/generation/gateways/fal";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, projectType, projectId } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    const result = await layerizeText(imageUrl, { prompt });

    // Persist to DB so user can retrieve and re-edit later
    const design = await prisma.layerizedDesign.create({
      data: {
        userId: "local",  // replace with session user when auth is active
        sourceImageUrl: imageUrl,
        backgroundUrl: result.backgroundUrl,
        textContainers: result.textContainers as never,
        overlayHtml: result.overlayHtml,
        imageLayers: result.imageLayers as never,
        falSeed: result.seed,
        projectType: projectType || null,
        projectId: projectId || null,
      },
    });

    return NextResponse.json({
      ok: true,
      designId: design.id,
      backgroundUrl: result.backgroundUrl,
      textContainers: result.textContainers,
      overlayHtml: result.overlayHtml,
      seed: result.seed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Layerize] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Save user's text edits (no API call — just DB update)
export async function PATCH(req: NextRequest) {
  try {
    const { designId, textEdits } = await req.json();
    if (!designId) return NextResponse.json({ error: "designId required" }, { status: 400 });

    const design = await prisma.layerizedDesign.update({
      where: { id: designId },
      data: { currentTextEdits: textEdits, updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, designId: design.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
