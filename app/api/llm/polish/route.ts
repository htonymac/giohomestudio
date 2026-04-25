// POST /api/llm/polish
// Polish a raw instruction/prompt for professional use.
// Uses Claude Haiku 4.5 for fast, cheap polishing.
//
// Request:  { prompt: string }
// Response: { polishedPrompt: string }
//
// Fallback: returns original prompt if API key missing or call fails.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  let prompt = "";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return NextResponse.json({ polishedPrompt: "" }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ polishedPrompt: prompt });
  }

  // No API key → silent pass-through
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ polishedPrompt: prompt });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a professional prompt-polishing assistant for a video/image AI generation tool.
Given a raw user instruction, return a polished, professional version that is clearer, more specific, and more likely to produce a high-quality result.
Return ONLY the polished instruction — no explanation, no quotes, no markdown.
Keep the original intent intact. Do not add unrelated concepts. Be concise (under 120 words).`,
      messages: [
        { role: "user", content: `Polish this instruction: "${prompt}"` },
      ],
    });

    const polished = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ polishedPrompt: polished || prompt });
  } catch {
    // Silent fallback — never break caller
    return NextResponse.json({ polishedPrompt: prompt });
  }
}
