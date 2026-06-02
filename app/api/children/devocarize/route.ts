// POST /api/children/devocarize — simplify story vocabulary for a target age.
//
// Henry 2026-06-02: kids can't follow stories with hard words. Send the
// current text + target age (5, 6, 7, 8). LLM rewrites it so a kid of that
// age can easily understand — short sentences, simple synonyms, kept plot.
//
// Body: { text: string, age: 5 | 6 | 7 | 8 }
// Response: { simplified: string, model: string }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const AGE_GUIDANCE: Record<number, string> = {
  5: "Vocabulary level: kindergarten. Use only words a 5-year-old hears daily (mum, dad, dog, run, play, big, small, sun, food). Sentences 4-7 words. No metaphors, no idioms. One idea per sentence. Replace any hard word with its simplest synonym.",
  6: "Vocabulary level: early primary (age 6). Words a first-grade child uses. Sentences 5-9 words. Avoid abstract nouns. Replace any 3+ syllable word unless it's a name. Keep all plot events.",
  7: "Vocabulary level: primary (age 7). Words a second-grade child reads. Sentences 6-10 words. Simple connectors (and, but, then, so). Avoid passive voice. Avoid metaphors. Keep names of characters and places.",
  8: "Vocabulary level: primary (age 8). Words a third-grade child reads. Sentences 7-12 words. Plain verbs. Concrete nouns. Limited metaphors only if very common. Keep dialog natural-sounding.",
};

export async function POST(req: NextRequest) {
  try {
    const { text, age } = await req.json() as { text?: string; age?: number };
    const cleanText = String(text || "").trim();
    if (!cleanText) return NextResponse.json({ error: "text required" }, { status: 400 });
    if (cleanText.length > 12000) {
      return NextResponse.json({ error: "text too long (max 12,000 chars)" }, { status: 400 });
    }
    const targetAge = Number(age);
    if (!AGE_GUIDANCE[targetAge]) {
      return NextResponse.json({ error: "age must be 5, 6, 7, or 8" }, { status: 400 });
    }

    const guidance = AGE_GUIDANCE[targetAge];
    const system = `You rewrite children's stories for a target reading age. ${guidance}

Rules:
- KEEP every event, character, and plot beat from the original. Do not invent or remove story content.
- KEEP character and place names exactly as written.
- REPLACE hard words with simple ones. Examples: "intrepid" → "brave", "ventured" → "went", "obscure" → "hidden", "magnificent" → "beautiful".
- SHORTEN sentences if they're longer than the age-appropriate length.
- Output the rewritten story ONLY. No preamble, no explanation, no list of changes.
- Preserve paragraph breaks if present.`;

    const prompt = `Original story:\n\n${cleanText}\n\nRewrite for a ${targetAge}-year-old. Output the new story only.`;

    const result = await callLLM(prompt, system, { speed: "fast" });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "LLM call failed" }, { status: 502 });
    }

    return NextResponse.json({
      simplified: result.text.trim(),
      model: result.provider,
      targetAge,
    });
  } catch (err) {
    console.error("[devocarize] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "devocarize failed" },
      { status: 500 }
    );
  }
}
