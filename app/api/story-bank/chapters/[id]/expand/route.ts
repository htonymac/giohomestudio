// POST /api/story-bank/chapters/[id]/expand
import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  try {
    const { chapterTitle, chapterSummary, storyContext, targetDurationSeconds, userNotes, existingScenes } = await req.json();
    const totalSec = targetDurationSeconds || 30;
    const hasScenes = existingScenes?.length > 0;
    const prompt = `You are a professional story writer and AI video director.

Story context: ${storyContext || "not provided"}
Chapter: "${chapterTitle}"
Summary: ${chapterSummary || "not provided"}
Target chapter duration: ${totalSec} seconds
Notes: ${userNotes || "none"}
${hasScenes ? `Existing scenes: ${JSON.stringify(existingScenes)}` : ""}

${hasScenes ? "Improve and expand the existing scenes." : "Write scenes for this chapter."}
Rules: each scene = 5, 8, or 10s. Total ≈ ${totalSec}s. 3-6 scenes. Vivid CAMERA descriptions.

Return ONLY valid JSON:
{
  "summary": "Updated chapter summary (2-3 sentences)",
  "scenes": [
    { "title": "Scene title", "description": "Camera description.", "durationSeconds": 5, "notes": "Optional director note" }
  ]
}`;
    const result = await callLLM(prompt, "Return only valid JSON.", { role: "quality" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "AI returned invalid JSON", raw: result.text }, { status: 500 });
    return NextResponse.json({ ok: true, expanded: JSON.parse(jsonMatch[0]) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "expand failed" }, { status: 500 });
  }
}
