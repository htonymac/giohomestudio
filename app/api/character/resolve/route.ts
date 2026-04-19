// POST /api/character/resolve — Resolve character tokens in a prompt
//
// Accepts: { prompt: string }
// Returns: ResolvedPrompt with display prompt, enriched prompt, characters, and reference images

import { NextRequest, NextResponse } from "next/server";
import { resolveCharacterTokens } from "@/lib/character-resolver";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 },
      );
    }

    const resolved = await resolveCharacterTokens(prompt);
    return NextResponse.json(resolved);
  } catch (e: unknown) {
    console.error("[character/resolve] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
