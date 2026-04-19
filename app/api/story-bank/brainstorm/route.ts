// POST /api/story-bank/brainstorm
// AI brainstorming partner. Uses local LLM first for low cost.
import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const { message, storyContext, messages } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

    const history = (messages || [])
      .slice(-6)
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");

    const prompt = `${history ? `Previous conversation:\n${history}\n\n` : ""}User: ${message}`;
    const system = `You are a creative story development partner helping a video creator.
Help brainstorm, expand, and improve their story. Think about how ideas translate to VIDEO.
Story context: ${storyContext || "not yet provided"}
Be specific and concise (3-6 sentences unless asked for more). Low cost mode — no padding.`;

    const result = await callLLM(prompt, system, { role: "fast" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, reply: result.text.trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "brainstorm failed" }, { status: 500 });
  }
}
