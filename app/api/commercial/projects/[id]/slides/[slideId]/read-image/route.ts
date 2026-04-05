// POST /api/commercial/projects/[id]/slides/[slideId]/read-image
// Analyzes the slide's uploaded image using AI vision (Claude, GPT-4o, or Ollama vision)
// and returns suggested caption and narration text for the editor to review.
// Does NOT save automatically — UI shows results for accept/reject.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { loadLLMSettings } from "@/lib/llm-settings";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — Anthropic/OpenAI both reject larger images

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function getMediaType(filePath: string): ImageMediaType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png")  return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function visionPrompt(brandName?: string, captionMaxWords?: number, captionMaxChars?: number | null): string {
  const brand      = brandName ? ` for ${brandName}` : "";
  const wordLimit  = captionMaxWords ?? 8;
  const charNote   = captionMaxChars ? ` (max ${captionMaxChars} characters)` : "";
  return `Look at this image carefully and describe what you ACTUALLY see${brand}. Identify the specific product, people, colors, setting, and any text or branding visible.

Return exactly two lines:
CAPTION: [max ${wordLimit} words${charNote} — name the actual product/subject/scene, START with 1-2 relevant emojis that match the subject (e.g. 🏠 for property, 🍽️ for food, 👗 for fashion, 💊 for health, 🚗 for auto, 💻 for tech)]
NARRATION: [one spoken sentence describing what a viewer sees and why it matters — include 1-2 emojis naturally woven into the text — no word limit]

RULES — follow strictly:
- Never use generic phrases like "Modern Elegance", "Experience Excellence", "Discover Quality", "Premium Choice"
- CAPTION must name the actual item, person, or scene (e.g. "🏠 Ocean View Apartment", "🍛 Crispy Jollof Rice Platter")
- CAPTION must be ${wordLimit} words or fewer${charNote}
- Always begin CAPTION with 1-2 fitting emojis
- If text is visible in the image, reference it
- Output ONLY those two lines, nothing else`;
}

function parseVisionOutput(text: string): { caption: string; narration: string } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let caption = "";
  let narration = "";
  for (const line of lines) {
    if (line.toUpperCase().startsWith("CAPTION:")) {
      caption = line.slice(line.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "");
    } else if (line.toUpperCase().startsWith("NARRATION:")) {
      narration = line.slice(line.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  // Fallback: first two non-empty lines if structured output wasn't followed
  if (!caption && lines[0]) caption = lines[0].replace(/^["']|["']$/g, "");
  if (!narration && lines[1]) narration = lines[1].replace(/^["']|["']$/g, "");
  return { caption, narration };
}

interface VisionCtx { brandName?: string; captionMaxWords?: number; captionMaxChars?: number | null }

function enforceCapLimits(result: { caption: string; narration: string }, ctx: VisionCtx) {
  let { caption } = result;
  if (ctx.captionMaxWords) {
    const words = caption.split(/\s+/);
    if (words.length > ctx.captionMaxWords) caption = words.slice(0, ctx.captionMaxWords).join(" ");
  }
  if (ctx.captionMaxChars && caption.length > ctx.captionMaxChars) {
    caption = caption.slice(0, ctx.captionMaxChars).trimEnd();
  }
  return { ...result, caption };
}

async function readViaAnthropic(base64: string, mediaType: ImageMediaType, ctx: VisionCtx): Promise<{ caption: string; narration: string }> {
  const key = loadLLMSettings().ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: visionPrompt(ctx.brandName, ctx.captionMaxWords, ctx.captionMaxChars) },
      ],
    }],
  });
  return enforceCapLimits(parseVisionOutput((msg.content[0] as { type: string; text: string })?.text ?? ""), ctx);
}

async function readViaOpenAI(base64: string, mediaType: ImageMediaType, ctx: VisionCtx): Promise<{ caption: string; narration: string }> {
  const key = loadLLMSettings().OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
        { type: "text", text: visionPrompt(ctx.brandName, ctx.captionMaxWords, ctx.captionMaxChars) },
      ],
    }],
  });
  return enforceCapLimits(parseVisionOutput(res.choices[0]?.message?.content ?? ""), ctx);
}

async function readViaGrok(base64: string, mediaType: ImageMediaType, ctx: VisionCtx): Promise<{ caption: string; narration: string }> {
  const key = loadLLMSettings().XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY not set");

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" });
  const res = await client.chat.completions.create({
    model: "grok-2-vision-1212",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
        { type: "text", text: visionPrompt(ctx.brandName, ctx.captionMaxWords, ctx.captionMaxChars) },
      ],
    }],
  });
  return enforceCapLimits(parseVisionOutput(res.choices[0]?.message?.content ?? ""), ctx);
}

async function readViaOllama(base64: string, ctx: VisionCtx): Promise<{ caption: string; narration: string; model: string }> {
  const settings = loadLLMSettings();
  const ollamaBase = settings.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = settings.OLLAMA_MODEL_VISION || "llava:latest";

  const res = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: visionPrompt(ctx.brandName, ctx.captionMaxWords, ctx.captionMaxChars),
        images: [base64],
      }],
      stream: false,
      options: { temperature: 0.3, num_predict: 200 },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data?.message?.content ?? "").trim();
  if (!text) throw new Error("Ollama returned empty response");
  return { ...enforceCapLimits(parseVisionOutput(text), ctx), model };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;

  const slide = await prisma.commercialSlide.findUnique({
    where: { id: slideId },
    select: {
      projectId: true,
      imagePath: true,
      project: { select: { brandName: true } },
    },
  });

  if (!slide || slide.projectId !== id) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }
  if (!slide.imagePath) {
    return NextResponse.json({ error: "No image on this slide" }, { status: 400 });
  }

  // Fetch caption limits via raw query to avoid Prisma client cache issues after schema changes
  let captionMaxWords = 8;
  let captionMaxChars: number | null = null;
  try {
    const proj = await prisma.$queryRaw<Array<{ captionMaxWords: number | null; captionMaxChars: number | null }>>`
      SELECT "captionMaxWords", "captionMaxChars" FROM commercial_projects WHERE id = ${id} LIMIT 1
    `;
    if (proj[0]) {
      captionMaxWords = proj[0].captionMaxWords ?? 8;
      captionMaxChars = proj[0].captionMaxChars ?? null;
    }
  } catch {
    // If the columns don't exist yet (pre-migration), just use defaults
  }

  const absPath = path.resolve(slide.imagePath);

  let imgBuffer: Buffer;
  try {
    imgBuffer = await fs.promises.readFile(absPath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Image file not found on disk" }, { status: 404 });
    }
    throw err;
  }

  if (imgBuffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image is too large (${(imgBuffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.` },
      { status: 413 }
    );
  }

  const base64   = imgBuffer.toString("base64");
  const mediaType = getMediaType(absPath);
  const ctx: VisionCtx = {
    brandName: slide.project?.brandName ?? undefined,
    captionMaxWords,
    captionMaxChars,
  };

  const settings = loadLLMSettings();
  const errors: string[] = [];

  if (settings.ANTHROPIC_API_KEY) {
    try {
      const result = await readViaAnthropic(base64, mediaType, ctx);
      return NextResponse.json({ ...result, provider: "claude" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[read-image:${slideId}] Anthropic failed:`, msg);
      errors.push(`claude: ${msg}`);
    }
  }

  if (settings.OPENAI_API_KEY) {
    try {
      const result = await readViaOpenAI(base64, mediaType, ctx);
      return NextResponse.json({ ...result, provider: "openai" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[read-image:${slideId}] OpenAI failed:`, msg);
      errors.push(`openai: ${msg}`);
    }
  }

  if (settings.XAI_API_KEY) {
    try {
      const result = await readViaGrok(base64, mediaType, ctx);
      return NextResponse.json({ ...result, provider: "grok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[read-image:${slideId}] Grok failed:`, msg);
      errors.push(`grok: ${msg}`);
    }
  }

  try {
    const { model, ...result } = await readViaOllama(base64, ctx);
    return NextResponse.json({ ...result, provider: `ollama/${model}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[read-image:${slideId}] Ollama failed:`, msg);
    errors.push(`ollama: ${msg}`);
  }

  return NextResponse.json(
    {
      error: "No vision-capable provider available. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY (Grok), or install a vision model in Ollama (e.g. llava, qwen2-vl).",
      details: errors,
    },
    { status: 503 }
  );
}
