// POST /api/translate
// Translates a text string into a target language via the LLM.
// Returns { original, translated } or falls back to returning original on failure.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";

const schema = z.object({
  text:           z.string().min(1).max(3000),
  targetLanguage: z.string().min(2).max(60),
});

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "French", es: "Spanish", pt: "Portuguese", de: "German",
  it: "Italian", nl: "Dutch", pl: "Polish", ru: "Russian",
  zh: "Mandarin Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", yo: "Yoruba", ha: "Hausa",
  ig: "Igbo", sw: "Swahili", pcm: "Nigerian Pidgin English",
};

export async function POST(req: NextRequest) {
  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { text, targetLanguage } = parsed.data;
  const langLabel = LANGUAGE_LABELS[targetLanguage] ?? targetLanguage;

  const result = await callLLM(
    `Translate the following text to ${langLabel}. Output ONLY the translated text, nothing else.\n\nText:\n${text}`,
    `You are a professional translator. Preserve tone, line breaks, and punctuation. Do not add explanations.`,
    { role: "fast", temperature: 0.3, maxTokens: 2500, timeoutMs: 20000 }
  );

  if (!result.ok) {
    return NextResponse.json({ original: text, translated: text, usedFallback: true });
  }

  return NextResponse.json({ original: text, translated: result.text.trim() });
}
