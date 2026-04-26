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
  duration:      z.enum(["15", "30", "60", "90"]).default("30"),
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

  const wordLimit = d.duration === "15" ? 30
    : d.duration === "30" ? 60
    : d.duration === "60" ? 120
    : 180;

  const toneMap: Record<string, string> = {
    Luxury:       "premium, aspirational, sophisticated — evoke desire and exclusivity",
    Professional: "clear, trustworthy, direct — build confidence and credibility",
    Energetic:    "exciting, high-energy, punchy — create excitement and urgency",
    Friendly:     "warm, conversational, approachable — feel human and relatable",
    Urgent:       "time-sensitive, action-driven — create FOMO and immediate action",
  };

  const result = await callLLM(
    `Write a ${d.duration}-second commercial voiceover script for this product/service:\n\nProduct: ${productLine || d.companyName}\n${featsLine}\n${offerLine}\n${priceLine}\n${websiteLine}\nBrand: ${d.companyName}\nCall to action: ${ctaLine}\n\nRules:\n- Natural spoken language only\n- No headers, no bullet points, no stage directions\n- Under ${wordLimit} words total\n- End with the call to action\n- Include 2-4 relevant emojis naturally placed in the text (e.g. 🔥 before offers, ✅ before benefits, 📞 before contact, 🏠 for property, 🍽️ for food)\n- Make it sound like a professional ad voiceover`,
    `You are a commercial copywriter who writes voiceover scripts for video ads. Tone: ${toneMap[d.tone] ?? toneMap.Professional}. Output only the script text — no formatting, no labels, just the words with emojis naturally woven in.`,
    { role: "creative", temperature: 0.6, maxTokens: 350, timeoutMs: 20000 }
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "LLM unavailable. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama.", detail: result.error },
      { status: 503 }
    );
  }

  return NextResponse.json({ script: result.text.trim() });
}
