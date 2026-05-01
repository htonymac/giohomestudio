// POST /api/movie/plan
// Generates an AI production plan for movie planner
// Body: { storyText, mode?, genre?, tone? }
// Returns: { plan: { scenes, musicMood, visualStyle, narratorTone, pacing, sceneCount } }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, genre, tone } = body as {
      storyText?: string;
      genre?: string;
      tone?: string;
    };

    if (!storyText?.trim()) {
      return NextResponse.json({ error: "storyText is required" }, { status: 400 });
    }

    const systemPrompt = "You are a professional movie production planner. Return only valid JSON, no markdown fences.";

    const userPrompt = `Analyze this story and produce a structured production plan.

Story: ${storyText.slice(0, 1000)}
Genre: ${genre || "Drama"}
Tone: ${tone || "Cinematic"}

Return a JSON object with this exact shape:
{
  "scenes": [
    { "id": "SC01", "title": "Opening / Setup", "description": "Brief scene description", "duration": "30s" },
    { "id": "SC02", "title": "Rising Action", "description": "...", "duration": "45s" }
  ],
  "musicMood": "Tense / Dramatic",
  "visualStyle": "Dark Cinematic",
  "narratorTone": "Authoritative",
  "pacing": "Slow build, fast climax",
  "sceneCount": 6
}

Rules:
- 4 to 8 scenes
- scene durations: 15s–90s
- musicMood: specific and evocative
- visualStyle matches genre and tone`;

    const result = await callLLM(userPrompt, systemPrompt, { maxTokens: 1200 });
    const raw = typeof result === "string" ? result : (result as { text?: string }).text ?? "";

    let plan: Record<string, unknown> = {};
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end > start) {
        plan = JSON.parse(raw.slice(start, end + 1));
      }
    } catch {
      // Build fallback plan
      plan = {
        scenes: [
          { id: "SC01", title: "Opening", description: "Establish setting and mood", duration: "30s" },
          { id: "SC02", title: "Rising Action", description: "Conflict begins", duration: "45s" },
          { id: "SC03", title: "Climax", description: "Peak tension", duration: "30s" },
          { id: "SC04", title: "Resolution", description: "Story wraps up", duration: "20s" },
        ],
        musicMood: genre?.toLowerCase().includes("action") ? "Intense / Dramatic" : "Cinematic / Emotional",
        visualStyle: tone || "Cinematic",
        narratorTone: "Neutral",
        pacing: "Standard",
        sceneCount: 4,
      };
    }

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    console.error("[movie/plan]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
