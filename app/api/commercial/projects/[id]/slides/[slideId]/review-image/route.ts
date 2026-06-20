// POST /api/commercial/projects/[id]/slides/[slideId]/review-image
// Vision-based MARKETING REVIEW of the slide's image — an exotic ad-director critique
// (hook / what it sells / weakness / best angle / one fix), NOT a generic caption.
// Mirrors read-image's provider cascade (Claude vision → GPT-4o → Grok → Ollama).
// Read-only: does NOT modify the slide. UI shows the review panel.

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

function reviewPrompt(brand?: string): string {
  const b = brand ? ` The brand is "${brand}".` : "";
  return `You are a senior advertising creative director reviewing this image for a paid social ad (Reels/TikTok/Shorts).${b} Look at the ACTUAL image — specific objects, lighting, composition, colors, mood.

Give a punchy, SPECIFIC marketing review. Return EXACTLY these labelled lines (no preamble, no markdown):
HOOK: [does it stop the scroll in 1s? why or why not — reference what's actually shown]
SELLS: [the single strongest selling point this exact image conveys]
WEAK: [the one biggest weakness hurting conversion]
ANGLE: [the best marketing angle/emotion to lead with for THIS image]
FIX: [one concrete, doable improvement — reshoot tip, crop, overlay, or caption direction]

Rules: be specific to what is literally visible. NO generic filler ("modern", "elegant", "premium", "high quality", "stunning", "eye-catching"). Name real things in the image. Each line one sentence.`;
}

function parseReview(text: string): { review: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const line of text.split("\n").map(l => l.trim()).filter(Boolean)) {
    const m = line.match(/^(HOOK|SELLS|WEAK|ANGLE|FIX)\s*:\s*(.+)$/i);
    if (m) fields[m[1].toUpperCase()] = m[2].trim();
  }
  // review = the labelled block if parsed, else the raw text
  const ordered = ["HOOK", "SELLS", "WEAK", "ANGLE", "FIX"];
  const review = ordered.filter(k => fields[k]).map(k => `${k}: ${fields[k]}`).join("\n") || text.trim();
  return { review, fields };
}

async function viaAnthropic(b64: string, mt: ImageMediaType, brand?: string) {
  const key = loadLLMSettings().ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 320,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
      { type: "text", text: reviewPrompt(brand) },
    ] }],
  });
  return (msg.content[0] as { type: string; text: string })?.text ?? "";
}

async function viaOpenAILike(b64: string, mt: ImageMediaType, brand: string | undefined, key: string, baseURL: string | undefined, model: string) {
  const client = new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
  const res = await client.chat.completions.create({
    model, max_tokens: 320,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:${mt};base64,${b64}` } },
      { type: "text", text: reviewPrompt(brand) },
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
    body: JSON.stringify({ model, messages: [{ role: "user", content: reviewPrompt(brand), images: [b64] }], stream: false, options: { temperature: 0.4, num_predict: 320 } }),
    signal: AbortSignal.timeout(120_000), // CPU vision is slow — give local a fair chance before cheap-cloud fallback
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

  // LOCAL-FIRST (Henry 2026-06-19: keep it free — use the server's Ollama vision model first;
  // fall back to CHEAP cloud (Claude Haiku / GPT-4o-mini) only if local is unavailable/fails).
  const attempts: Array<[string, () => Promise<string>]> = [];
  attempts.push(["ollama", () => viaOllama(b64, brand)]);
  if (s.ANTHROPIC_API_KEY) attempts.push(["claude-haiku", () => viaAnthropic(b64, mt, brand)]);
  if (s.OPENAI_API_KEY) attempts.push(["gpt-4o-mini", () => viaOpenAILike(b64, mt, brand, s.OPENAI_API_KEY!, undefined, "gpt-4o-mini")]);

  for (const [provider, fn] of attempts) {
    try {
      const text = await fn();
      if (text && text.trim()) {
        const { review, fields } = parseReview(text);
        return NextResponse.json({ review, fields, provider });
      }
    } catch (err) {
      errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`[review-image:${slideId}] ${provider} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json({ error: "No vision provider available for review.", details: errors }, { status: 503 });
}
