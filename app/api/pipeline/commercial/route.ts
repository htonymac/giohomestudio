// GioHomeStudio — POST /api/pipeline/commercial
//
// Dedicated execution path for the Commercial Maker.
// Accepts structured slide content, assembles a beat-tagged script with one
// [IMAGE:] marker per slide, then fires the images_audio pipeline so each
// slide gets a ComfyUI-generated visual + narration + background music.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/core/pipeline";
import { createContentItem } from "@/modules/content-registry";

const schema = z.object({
  brandName:      z.string().max(100).optional(),
  productDesc:    z.string().min(3, "Product description is required"),
  targetAudience: z.string().max(200).optional(),
  slides: z.object({
    hook:     z.string().max(500).optional(),
    problem:  z.string().max(500).optional(),
    solution: z.string().max(500).optional(),
    cta:      z.string().max(500).optional(),
  }),
  adTone:           z.enum(["energetic", "professional", "emotional", "urgent"]).default("professional"),
  durationSeconds:  z.number().min(10).max(60).default(30),
  aspectRatio:      z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  musicGenre:       z.enum(["cinematic", "electronic", "acoustic", "orchestral", "ambient", "hip_hop"]).default("cinematic"),
  destinationPageId: z.string().optional(),
});

// Build image description for each slide role — tells ComfyUI what visual to generate
function slideImagePrompt(role: string, brandName: string, slideText: string, adTone: string): string {
  const brand = brandName ? `for ${brandName}, ` : "";
  switch (role) {
    case "hook":
      return `${brand}${adTone} attention-grabbing commercial opening, bold typography, modern design, ${slideText.slice(0, 60)}`;
    case "problem":
      return `${brand}visual of problem or pain point, frustrated person, relatable situation, ${slideText.slice(0, 60)}`;
    case "solution":
      return `${brand}product or service in action, satisfied customer, modern clean interface, solution demonstration, ${slideText.slice(0, 60)}`;
    case "cta":
      return `${brand}strong call to action, logo, website URL, clean professional end card, ${adTone} style`;
    default:
      return `${brand}${slideText.slice(0, 80)}`;
  }
}

// Assemble the beat-tagged script from slide data.
// Each filled slide becomes: [IMAGE: ...] + slide narration text.
// Empty slides get AI-generated text via the prompt enhancer (aiAutoMode).
function buildCommercialScript(data: z.infer<typeof schema>): string {
  const brand = data.brandName?.trim() ?? "";
  const tone  = data.adTone;
  const lines: string[] = [];

  const SLIDE_ROLES: Array<{ role: keyof typeof data.slides; fallback: string }> = [
    { role: "hook",     fallback: `${brand ? brand + " — " : ""}Did you know most businesses struggle with this?` },
    { role: "problem",  fallback: `${data.productDesc} — but getting it right is harder than it looks.` },
    { role: "solution", fallback: `${brand ? brand + " " : ""}changes everything. ${data.productDesc}` },
    { role: "cta",      fallback: `Try ${brand || "it"} free today. Your results are waiting.` },
  ];

  for (const { role, fallback } of SLIDE_ROLES) {
    const text = data.slides[role]?.trim() || fallback;
    const imgPrompt = slideImagePrompt(role, brand, text, tone);
    lines.push(`[IMAGE: ${imgPrompt}]`);
    lines.push(text);
    lines.push(""); // blank line separates beats
  }

  return lines.join("\n").trim();
}

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

    const data = parsed.data;
    const script = buildCommercialScript(data);

    // Create content item up-front so ID is returned before generation begins
    const contentItem = await createContentItem({
      originalInput: script,
      mode: "FREE",
      outputMode: "images_audio",
      audioMode: "voice_music",
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      musicGenre: data.musicGenre,
      destinationPageId: data.destinationPageId,
      aiAutoMode: true,
    });

    // Fire commercial pipeline in background
    runPipeline({
      rawInput:    script,
      outputMode:  "images_audio",
      audioMode:   "voice_music",
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      musicGenre:  data.musicGenre,
      destinationPageId: data.destinationPageId,
      aiAutoMode:  true,
      contentItemId: contentItem.id,
    }).catch(err => console.error("[API /pipeline/commercial] Pipeline error:", err));

    return NextResponse.json(
      {
        contentItemId: contentItem.id,
        message: `Commercial pipeline started (${data.durationSeconds}s, ${data.aspectRatio}). Check Review when ready.`,
        script,
      },
      { status: 202 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
