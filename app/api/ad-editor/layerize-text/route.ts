// POST /api/ad-editor/layerize-text
// Separates text layers from an image using fal-ai/ideogram/v3/layerize-text
// Returns { ok: true, background_url, text_containers, overlay_html, seed } or { error }

import { NextRequest, NextResponse } from "next/server";

interface LayerizeTextRequest {
  image_url: string;
  prompt?: string;
  font_name_h1?: string | null;
  font_name_h2?: string | null;
}

export async function POST(req: NextRequest) {
  let body: LayerizeTextRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { image_url, prompt, font_name_h1, font_name_h2 } = body;
  if (!image_url) {
    return NextResponse.json({ error: "image_url is required" }, { status: 400 });
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  const falInput = {
    image_url,
    prompt: prompt || "",
    font_name_h1: font_name_h1 ?? null,
    font_name_h2: font_name_h2 ?? null,
  };

  try {
    // Migrated to providers/fal adapter (Henry 2026-05-30 task #29).
    const { falLayerizeText } = await import("@/lib/providers/fal");
    const r = await falLayerizeText<{ background_url?: string; image?: { url?: string }; text_containers?: unknown[]; overlay_html?: string; seed?: number }>(falInput);

    if (!r.ok) {
      console.error("[layerize-text] FAL error:", r.status, r.error);
      return NextResponse.json({ error: `FAL request failed: ${r.status}` }, { status: 500 });
    }

    const data = r.data;

    return NextResponse.json({
      ok: true,
      background_url: data.background_url ?? data.image?.url ?? null,
      text_containers: data.text_containers ?? [],
      overlay_html: data.overlay_html ?? "",
      seed: data.seed ?? null,
    });
  } catch (e) {
    console.error("[layerize-text] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
