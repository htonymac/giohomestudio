// POST /api/story-bank/stories/[id]/expand
import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  try {
    const { title, genre, tone, logline, targetDurationSeconds, userNotes } = await req.json();
    const totalSec = targetDurationSeconds || 60;
    const prompt = `You are a professional story writer and video director.

Story: "${title}"
Genre: ${genre || "general"}, Tone: ${tone || "neutral"}
Logline: ${logline || title}
Target video duration: ${totalSec} seconds total
User notes: ${userNotes || "none"}

Expand into chapters and scenes for AI video generation.
Rules: each scene = 5, 8, or 10 seconds. Total scenes duration ≈ ${totalSec}s. 2-4 chapters, 3-6 scenes each.
Write vivid CAMERA descriptions — what the viewer SEES.

Return ONLY valid JSON (no markdown, no explanation):
{
  "logline": "one sentence pitch",
  "chapters": [
    {
      "title": "Chapter title",
      "summary": "2-3 sentence summary",
      "scenes": [
        { "title": "Scene title", "description": "Camera description.", "durationSeconds": 5, "notes": "Optional" }
      ]
    }
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
