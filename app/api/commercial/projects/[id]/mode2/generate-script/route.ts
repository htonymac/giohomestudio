// POST /api/commercial/projects/[id]/mode2/generate-script
// Generates a narration/voiceover script from the confirmed ad details form.
// Works for any product type: software, food, fashion, real estate, tech, services, etc.
// Returns { script: string }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";

const schema = z.object({
  productType:   z.string().optional(),   // Software, Food, Real Estate, Fashion, etc.
  productName:   z.string().optional(),   // specific product name
  features:      z.string().optional(),   // comma-separated key features/benefits
  offer:         z.string().optional(),   // discount, promotion, special deal
  price:         z.string().optional(),
  website:       z.string().optional(),
  companyName:   z.string().min(1),
  contact:       z.string().optional(),
  contactMethod: z.string().optional(),
  tone:          z.enum(["Luxury", "Professional", "Energetic", "Friendly", "Urgent"]).default("Professional"),
  duration:      z.string().default("30"),       // any custom seconds (A3)
  style:         z.string().optional(),          // A9 punch-up directive (e.g. "more intense — strong action verbs")
  baseScript:    z.string().optional(),          // A9 current script to rewrite
  model:         z.string().optional(),          // C1 selectable AI model ("auto" | "provider:model" | "ollama")
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  const productLine  = [d.productType, d.productName].filter(Boolean).join(" — ");
  const featsLine    = d.features ? `Key benefits: ${d.features}.` : "";
  const offerLine    = d.offer    ? `Special offer: ${d.offer}.`   : "";
  const priceLine    = d.price    ? `Price: ${d.price}.`           : "";
  const websiteLine  = d.website  ? `Website: ${d.website}.`       : "";
  const ctaLine      = d.contact
    ? `Contact ${d.companyName} via ${d.contactMethod ?? "phone"}: ${d.contact}.`
    : `Contact ${d.companyName} today.`;

  const secs = Math.max(5, Math.min(600, parseInt(d.duration, 10) || 30));
  const wordLimit = Math.round(secs * 2);

  const toneMap: Record<string, string> = {
    Luxury:       "premium, aspirational, sophisticated — evoke desire and exclusivity",
    Professional: "clear, trustworthy, direct — build confidence and credibility",
    Energetic:    "exciting, high-energy, punchy — create excitement and urgency",
    Friendly:     "warm, conversational, approachable — feel human and relatable",
    Urgent:       "time-sensitive, action-driven — create FOMO and immediate action",
  };

  // A9: punch-up mode — rewrite the CURRENT script with a style directive + strong action verbs.
  const userPrompt = (d.style && d.baseScript)
    ? `Rewrite and punch up this commercial voiceover script to be ${d.style}. Use strong ACTION VERBS, vivid punchy language, and short energetic sentences. Keep it under ${wordLimit} words, keep the brand "${d.companyName}" and the call to action, and keep relevant emojis naturally placed.\n\nCurrent script:\n${d.baseScript}`
    : `Write a ${secs}-second commercial voiceover script for this product/service:\n\nProduct: ${productLine || d.companyName}\n${featsLine}\n${offerLine}\n${priceLine}\n${websiteLine}\nBrand: ${d.companyName}\nCall to action: ${ctaLine}\n\nRules:\n- Natural spoken language only\n- No headers, no bullet points, no stage directions\n- Under ${wordLimit} words total\n- End with the call to action\n- Include 2-4 relevant emojis naturally placed in the text (e.g. 🔥 before offers, ✅ before benefits, 📞 before contact, 🏠 for property, 🍽️ for food)\n- Make it sound like a professional ad voiceover`;

  // C1: optional user-selected model ("auto" | "provider:model" | "ollama"). Default = Haiku (fast/cheap).
  let forceProvider: "claude" | "openai" | "grok" | "ollama" | undefined;
  let forceModel: string | undefined = "claude-haiku-4-5-20251001";
  const sel = d.model && d.model !== "auto" ? d.model : "";
  if (sel === "ollama") { forceProvider = "ollama"; forceModel = undefined; }
  else if (sel.includes(":")) {
    const [prov, ...rest] = sel.split(":");
    forceProvider = prov === "openai" ? "openai" : prov === "grok" ? "grok" : "claude";
    forceModel = rest.join(":") || undefined;
  }

  const sysPrompt = `You are a commercial copywriter who writes voiceover scripts for video ads. Tone: ${toneMap[d.tone] ?? toneMap.Professional}.${d.style ? " Emphasize strong action verbs and vivid, energetic language." : ""} Output only the script text — no formatting, no labels, just the words with emojis naturally woven in.`;
  const timeoutMs = forceProvider === "ollama" ? 120_000 : 20_000;  // CPU-local text gen is slow
  let result = await callLLM(
    userPrompt,
    sysPrompt,
    { role: "creative", forceProvider, forceModel, temperature: 0.6, maxTokens: 350, timeoutMs }
  );
  // C1 robustness: a forced model that fails falls back to the default Haiku — never leave the user stuck.
  if (!result.ok && sel) {
    result = await callLLM(userPrompt, sysPrompt, { role: "creative", forceModel: "claude-haiku-4-5-20251001", temperature: 0.6, maxTokens: 350, timeoutMs: 20_000 });
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: "LLM unavailable. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama.", detail: result.error },
      { status: 503 }
    );
  }

  return NextResponse.json({ script: result.text.trim() });
}
