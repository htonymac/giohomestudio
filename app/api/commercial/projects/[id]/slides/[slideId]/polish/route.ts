// POST /api/commercial/projects/[id]/slides/[slideId]/polish
// Uses local Ollama (phi3) to rewrite a slide caption in polished marketing language.
// Returns { original, polished } so the UI can show before/after for accept/reject.
// Does NOT save automatically — client decides whether to apply the result.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm";

// Simple rule-based polish used when no LLM is available.
// Removes filler words, title-cases the text, appends energy words per tone.
function ruleBasisPolish(text: string, tone: string, maxWords?: number, maxChars?: number | null): string {
  const fillers = /\b(very|really|just|kind of|sort of|basically|actually|literally|quite)\b/gi;
  const cleaned = text.replace(fillers, "").replace(/\s{2,}/g, " ").trim();
  const titled  = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  const suffixes: Record<string, string> = {
    professional: "✅ Excellence Guaranteed",
    energetic:    "🔥 Limited Time Only!",
    warm:         "💛 We Care",
    urgent:       "⚡ Act Now",
  };
  const prefixes: Record<string, string> = {
    professional: "✨",
    energetic:    "🔥",
    warm:         "💛",
    urgent:       "⚡",
  };
  const prefix = prefixes[tone] ?? "✨";
  const suffix = suffixes[tone] ?? "";
  const wordCount = titled.split(" ").length;
  const limit = maxWords ?? 8;
  let result = wordCount <= limit ? `${prefix} ${titled} ${suffix}`.trim() : `${prefix} ${titled}`;
  // Trim to word limit
  const words = result.split(" ");
  if (words.length > limit) result = words.slice(0, limit).join(" ");
  // Trim to char limit
  if (maxChars && result.length > maxChars) result = result.slice(0, maxChars).trimEnd();
  return result;
}

const schema = z.object({
  text:      z.string().min(1).max(500),
  brandName: z.string().max(100).optional(),
  tone:      z.enum(["professional", "energetic", "warm", "urgent"]).optional(),
  field:     z.enum(["caption", "narration"]).optional(),
  maxWords:  z.number().int().min(1).max(50).optional(),
  maxChars:  z.number().int().min(5).max(300).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;

  const slide = await prisma.commercialSlide.findUnique({
    where: { id: slideId },
    select: { projectId: true },
  });
  if (!slide || slide.projectId !== id) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { text, brandName, tone = "professional", field = "caption", maxWords, maxChars } = parsed.data;

  const toneInstructions: Record<string, string> = {
    professional: "polished, trustworthy, clear",
    energetic:    "punchy, exciting, high energy",
    warm:         "friendly, heartfelt, approachable",
    urgent:       "time-sensitive, action-driven, direct",
  };

  const brand = brandName ? `Brand: ${brandName}. ` : "";

  const isNarration = field === "narration";

  // Caption limits from caller (project settings). Narration is always unlimited.
  const capWordLimit = !isNarration ? (maxWords ?? 8) : null;
  const capCharLimit = !isNarration ? (maxChars ?? null) : null;
  const limitInstr   = capWordLimit
    ? `Max ${capWordLimit} words${capCharLimit ? `, max ${capCharLimit} characters` : ""}.`
    : "";

  const prompt = isNarration
    ? `Rewrite this voiceover narration for a commercial video. Make it more engaging and natural to speak aloud. Keep it conversational. Naturally include 1-2 relevant emojis inside the text (e.g. ✅ for benefits, 🔥 for urgency, 💎 for premium, 📞 for CTA). Output only the rewritten narration, nothing else.\n\nOriginal: "${text}"`
    : `Rewrite this slide caption for a commercial video. Make it more compelling and marketing-ready. ${limitInstr} Start the caption with 1-2 relevant emojis that match the subject (e.g. 🏠 for property, 🍽️ for food, 🔥 for offers, ✅ for benefits, 💰 for price). Output only the rewritten caption, nothing else.\n\nOriginal: "${text}"`;

  const systemPrompt = isNarration
    ? `You are a commercial voiceover scriptwriter. ${brand}Tone: ${toneInstructions[tone]}. Write natural, speakable narration that sounds good when read aloud. Include 1-2 emojis naturally inside the text to add energy. No word limit.`
    : `You are a commercial copywriter. ${brand}Tone: ${toneInstructions[tone]}. Write short, punchy promotional captions that START with 1-2 fitting emojis. ${limitInstr}`;

  const result = await callLLM(
    prompt,
    systemPrompt,
    { role: "fast", temperature: 0.6, maxTokens: isNarration ? 400 : Math.max(40, (capWordLimit ?? 8) * 8), timeoutMs: 12000 }
  );

  if (!result.ok) {
    // Rule-based fallback — capitalize, trim filler words, add energy
    const polished = ruleBasisPolish(text, tone, capWordLimit ?? undefined, capCharLimit);
    return NextResponse.json({ original: text, polished, usedFallback: true });
  }

  // Strip surrounding quotes the model may add
  let polished = result.text.replace(/^["']|["']$/g, "").trim();

  // Hard-enforce caption limits (model may ignore instructions)
  if (!isNarration) {
    if (capWordLimit) {
      const words = polished.split(/\s+/);
      if (words.length > capWordLimit) polished = words.slice(0, capWordLimit).join(" ");
    }
    if (capCharLimit && polished.length > capCharLimit) {
      polished = polished.slice(0, capCharLimit).trimEnd();
    }
  }

  return NextResponse.json({ original: text, polished });
}
