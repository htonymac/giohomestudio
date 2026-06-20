// POST /api/commercial/projects/[id]/slides/[slideId]/review-caption
// Vision → ONE eloquent, FLATTERING, customer-facing caption for the image (5+ words),
// e.g. "Cozy spacious sitting room bathed in warm light". User-biased / appealing — the
// honest critique lives in the separate /review-image (Marketing Review) route.
// LOCAL-FIRST (server Ollama llava → cheap Haiku/4o-mini fallback). Read-only (UI applies it).

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { loadLLMSettings } from "@/lib/llm-settings";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function getMediaType(p: string): ImageMediaType {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function captionPrompt(brand?: string): string {
  const b = brand ? ` for ${brand}` : "";
  return `Look at this image${b}. Write ONE warm, eloquent, FLATTERING caption that makes a customer fall in love with what's shown — like "Cozy spacious sitting room bathed in soft light" or "Elegant fitted kitchen with sleek finishes" or "Serene bedroom glowing under gentle neon".

Rules: ONE sentence, 5+ words. Be SPECIFIC to what's literally in the image (name the real room/object/feature/colour/lighting). Positive, inviting, customer-appreciative tone. NO generic filler ("modern", "premium", "luxury", "high quality", "stunning"). Output ONLY the caption text — no quotes, no labels.`;
}

function cleanCaption(text: string): string {
  const first = (text || "").split("\n").map(l => l.trim()).filter(Boolean)[0] ?? "";
  return first.replace(/^["'`]+|["'`]+$/g, "").replace(/^caption:\s*/i, "").trim();
}

async function viaAnthropic(b64: string, mt: ImageMediaType, brand?: string) {
  const key = loadLLMSettings().ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
      { type: "text", text: captionPrompt(brand) },
    ] }],
  });
  return (msg.content[0] as { type: string; text: string })?.text ?? "";
}

async function viaOpenAILike(b64: string, mt: ImageMediaType, brand: string | undefined, key: string, baseURL: string | undefined, model: string) {
  const client = new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
  const res = await client.chat.completions.create({
    model, max_tokens: 80,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mt};base64,${b64}` } },
      { type: "text", text: captionPrompt(brand) },
    ] }],
  });
  return res.choices[0]?.message?.content ?? "";
}

async function viaOllama(b64: string, brand?: string) {
  const s = loadLLMSettings();
  const base = s.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = s.OLLAMA_MODEL_VISION || "llava:latest";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: captionPrompt(brand), images: [b64] }], stream: false, options: { temperature: 0.5, num_predict: 80 } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  const text = (data?.message?.content ?? "").trim();
  if (!text) throw new Error("Ollama empty");
  return text;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; slideId: string }> }) {
  const { id, slideId } = await params;
  const slide = await prisma.commercialSlide.findUnique({
    where: { id: slideId },
    select: { projectId: true, imagePath: true, project: { select: { brandName: true } } },
  });
  if (!slide || slide.projectId !== id) return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  if (!slide.imagePath) return NextResponse.json({ error: "No image on this slide" }, { status: 400 });

  const absPath = path.resolve(slide.imagePath);
  let buf: Buffer;
  try {
    buf = await fs.promises.readFile(absPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return NextResponse.json({ error: "Image file not found" }, { status: 404 });
    throw err;
  }
  if (buf.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 });

  const b64 = buf.toString("base64");
  const mt = getMediaType(absPath);
  const brand = slide.project?.brandName ?? undefined;
  const s = loadLLMSettings();
  const errors: string[] = [];

  const attempts: Array<[string, () => Promise<string>]> = [];
  attempts.push(["ollama", () => viaOllama(b64, brand)]);
  if (s.ANTHROPIC_API_KEY) attempts.push(["claude-haiku", () => viaAnthropic(b64, mt, brand)]);
  if (s.OPENAI_API_KEY) attempts.push(["gpt-4o-mini", () => viaOpenAILike(b64, mt, brand, s.OPENAI_API_KEY!, undefined, "gpt-4o-mini")]);

  for (const [provider, fn] of attempts) {
    try {
      const text = await fn();
      const caption = cleanCaption(text);
      if (caption) return NextResponse.json({ caption, provider });
    } catch (err) {
      errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`[review-caption:${slideId}] ${provider} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json({ error: "No vision provider available for caption.", details: errors }, { status: 503 });
}
