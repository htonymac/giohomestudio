// POST /api/llm/clarify
// Clarification AI flow — given a user prompt for image / video / background generation,
// decide whether the prompt is too short/vague and needs clarification.
// If it is, return 3–5 short follow-up questions.
// If it is specific enough, return a polished refined prompt.
//
// Request:  { prompt: string; context: "image" | "video" | "bg" }
// Response: { clarifications: string[]; refinedPrompt: string; needsClarification: boolean }
//
// Fallback: if ANTHROPIC_API_KEY is missing or the call fails, silently return
// { clarifications: [], refinedPrompt: prompt, needsClarification: false } so the UI passes through.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const GENERIC_REGEX = /^\s*(generate|make|create|draw|design)\s+(a|an|the)?\s*(image|bg|background|picture|pic|photo|scene)\s*\.?\s*$/i;

function isVague(prompt: string): boolean {
  const p = prompt.trim();
  if (p.length < 15) return true;
  if (GENERIC_REGEX.test(p)) return true;
  return false;
}

function passThrough(prompt: string) {
  return NextResponse.json({
    clarifications: [],
    refinedPrompt: prompt,
    needsClarification: false,
  });
}

export async function POST(req: NextRequest) {
  let prompt = "";
  let context: "image" | "video" | "bg" = "image";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const ctx = body?.context;
    if (ctx === "image" || ctx === "video" || ctx === "bg") context = ctx;
  } catch {
    return passThrough("");
  }

  if (!prompt.trim()) return passThrough(prompt);

  // Cheap path — clearly specific prompt (>= 30 chars, contains some descriptors)
  if (prompt.trim().length >= 30 && !GENERIC_REGEX.test(prompt.trim())) {
    // Try to polish via LLM, but if anything fails just return original.
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ clarifications: [], refinedPrompt: prompt, needsClarification: false });
    }
  }

  // No API key → silent pass-through
  if (!process.env.ANTHROPIC_API_KEY) return passThrough(prompt);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const system = `You are a prompt-quality assistant for an AI ${context === "video" ? "video" : "image"} generator inside an Ad Editor.
Given a raw user prompt, decide whether it is specific enough to produce a good result, or too vague.

Return ONLY strict JSON with this exact shape:
{
  "needsClarification": boolean,
  "clarifications": [string, ...],   // 3–5 short questions when needsClarification = true, else []
  "refinedPrompt": string             // a polished version of the prompt; if vague, your best guess expansion
}

Rules:
- If the prompt is short (under ~15 chars) OR generic like "generate an image", "make a bg", "create picture" → needsClarification = true and return 3–5 short clarifying questions.
  Example questions: "What product or subject?", "What colors or mood?", "Any background preference?", "Style (photo, cartoon, illustration)?", "Aspect or orientation?"
- If the prompt already mentions specific nouns/adjectives and is 30+ characters → needsClarification = false and return a polished refinedPrompt (add cinematic adjectives, keep user intent).
- Keep questions short (max 8 words each).
- No markdown, no code fences, no extra keys. JSON only.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system,
      messages: [
        { role: "user", content: `Context: ${context}\nPrompt: "${prompt}"` },
      ],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    // Extract JSON
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return passThrough(prompt);

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const needsClarification = !!parsed.needsClarification && Array.isArray(parsed.clarifications) && parsed.clarifications.length > 0;
    const clarifications: string[] = needsClarification
      ? parsed.clarifications.filter((q: unknown): q is string => typeof q === "string").slice(0, 5)
      : [];
    const refinedPrompt = typeof parsed.refinedPrompt === "string" && parsed.refinedPrompt.trim()
      ? parsed.refinedPrompt.trim()
      : prompt;

    // Safety fallback: trust local heuristic if LLM disagrees in the "clearly specific" direction
    const heuristicVague = isVague(prompt);
    const finalNeeds = needsClarification && heuristicVague ? true : needsClarification;

    return NextResponse.json({
      clarifications,
      refinedPrompt,
      needsClarification: finalNeeds,
    });
  } catch {
    return passThrough(prompt);
  }
}
