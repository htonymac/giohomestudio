// POST /api/commercial/plan-scenes
// Generates a 5-scene commercial video plan for AI Video Commercial (Mode 3).
// Takes product details and returns a JSON array of scenes [{purpose, prompt}]
// via the project's LLM router using claude-haiku (cheap tier).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";

const schema = z.object({
  productName:     z.string().optional(),
  productCategory: z.string().optional(),
  tagline:         z.string().optional(),
  price:           z.string().optional(),
  ctaText:         z.string().optional(),
  flavorVariant:   z.string().optional(),
  packSize:        z.string().optional(),
  brandColors:     z.string().optional(),
  brandStyle:      z.string().optional(),
  allowedClaims:   z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  const productDetails = [
    d.flavorVariant  && `Variant: ${d.flavorVariant}`,
    d.packSize       && `Pack size: ${d.packSize}`,
    d.brandColors    && `Brand colors: ${d.brandColors}`,
    d.brandStyle     && `Brand style: ${d.brandStyle}`,
    d.allowedClaims  && `Claims: ${d.allowedClaims}`,
  ].filter(Boolean).join(". ");

  const prompt = `Plan a 5-scene commercial video ad for: ${d.productName || "product"} (${d.productCategory || "general"}). Tagline: "${d.tagline || ""}". ${productDetails}. Price: ${d.price || "N/A"}. CTA: ${d.ctaText || "Order Now"}.

Return EXACTLY 5 scenes in this JSON array format, no other text:
[
  {"purpose":"Hook","prompt":"..."},
  {"purpose":"Features","prompt":"..."},
  {"purpose":"Price Reveal","prompt":"..."},
  {"purpose":"CTA","prompt":"..."},
  {"purpose":"Location/Lifestyle","prompt":"..."}
]

Each prompt should be a detailed cinematic video generation prompt for the product. Keep the product as hero.`;

  const result = await callLLM(
    prompt,
    "You are a commercial video director. Output only valid JSON — no markdown, no explanation, no code fences. Just the JSON array.",
    {
      role: "fast",
      forceModel: "claude-haiku-4-5-20251001",
      maxTokens: 600,
      temperature: 0.5,
      timeoutMs: 25000,
    }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "LLM unavailable. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama.", detail: result.error },
      { status: 503 }
    );
  }

  // Parse JSON array robustly — strip markdown fences if any
  const raw = result.text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "LLM returned unexpected format (no JSON array found)", raw: raw.slice(0, 300) },
      { status: 502 }
    );
  }

  let scenes: Array<{ purpose: string; prompt: string }>;
  try {
    scenes = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return NextResponse.json(
      { error: "LLM returned invalid JSON", detail: e instanceof Error ? e.message : String(e), raw: jsonMatch[0].slice(0, 300) },
      { status: 502 }
    );
  }

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json(
      { error: "LLM returned an empty scene list" },
      { status: 502 }
    );
  }

  return NextResponse.json({ scenes });
}
