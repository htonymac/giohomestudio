// POST /api/llm/chat — simple LLM call for client-side requests
// Returns { text, provider }

import { NextRequest, NextResponse } from "next/server";
import { callLLM, type LLMRole } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, system, role = "fast", maxTokens } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const result = await callLLM(prompt, system, {
      role: role as LLMRole,
      maxTokens: maxTokens || 400,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "LLM unavailable" }, { status: 503 });
    }

    return NextResponse.json({ text: result.text, provider: (result as { provider?: string }).provider });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
