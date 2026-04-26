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
    const res = await fetch("https://queue.fal.run/fal-ai/ideogram/v3/layerize-text", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falInput),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.error("[layerize-text] FAL error:", res.status, errText);
      return NextResponse.json({ error: `FAL request failed: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();

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
