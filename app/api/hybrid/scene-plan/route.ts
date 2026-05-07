// POST /api/hybrid/scene-plan
// Lightweight scene planner — works WITHOUT a DB projectId.
// Used by the Hybrid Planner's inline expand flow (localStorage-first).
//
// The existing /api/hybrid/scene-breakdown requires a DB projectId and saves to DB.
// This endpoint just calls the LLM and returns scenes as JSON — no DB needed.
// If projectId is provided it optionally saves, but it's not required.
//
// Accepts:
//   { storyText, characters, costPreference, targetDuration, projectId? }
//
// Returns:
//   { scenes: ScenePlan[] }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

interface CharacterInput {
  characterId: string;
  displayName: string;
  role: string;
  visualDescription?: string;
}

function buildPrompt(storyText: string, characters: CharacterInput[], costPreference: string): string {
  const charList = characters.length > 0
    ? characters.map(c => `- ${c.displayName} (${c.role})${c.visualDescription ? ": " + c.visualDescription : ""}`).join("\n")
    : "- No named characters yet";

  return `You are a professional film scene planner for an AI animation studio.

Read the following story carefully and break it into individual scenes. Each scene is one distinct moment, location, or beat.

STORY:
"""
${storyText.slice(0, 8000)}
"""

CHARACTERS:
${charList}

COST PREFERENCE: ${costPreference || "balanced"}

Rules:
- Aim for 5-10 scenes depending on story length
- Each scene gets a sceneType based on what it needs:
  * image-led: static image + narration (establishing shots, emotional moments, dialogue)
  * video-led: full motion needed (chase, fight, physical action)
  * image-to-video: starts still, gains motion (calm escalating to action)
  * audio-bridge: sound/narration only, no visual (time jumps, transitions)
  * hybrid: mix of still and motion within the scene
- Use the character IDs from the list above in characterIds
- description must be a vivid, visual sentence describing exactly what is seen in this scene (AI uses this to generate the image)
- If cost preference is "efficient", prefer image-led. If "premium", use more video-led.
- CRITICAL: Use the EXACT character names from the CHARACTERS list above in your scene descriptions and titles. Never rename characters or refer to them as "the villain" or "the hero" when a name is given.
- CRITICAL: Do NOT combine characters who are separate individuals into a group. If "Vex" is one character and "Bryan" is another, they appear separately unless the story says they're together.
- Scene titles must name a specific story event (e.g. "Vex Breaks Into the System", "Bryan's Last Stand"), not generic labels (e.g. "Scene 3", "The Confrontation").
- Scenes must follow the story's actual narrative order — do not invent new plot beats or skip major story events.
- Scene descriptions must describe what is SEEN visually — use character names and locations from the story.

Return ONLY a valid JSON array, no markdown:
[
  {
    "sceneId": "SC01",
    "title": "Short scene title",
    "description": "Vivid visual description of what is seen in this scene — used directly for image generation",
    "location": "Where the scene takes place",
    "timeOfDay": "morning|afternoon|evening|night|dawn|dusk",
    "mood": "tense|calm|joyful|sad|mysterious|dramatic|hopeful|dark|comedic",
    "sceneType": "image-led|video-led|image-to-video|audio-bridge|hybrid",
    "characterIds": ["CH01", "CH02"],
    "narrationIntensity": "low|medium|high",
    "dialogueDensity": "low|medium|high",
    "emotionalWeight": "low|medium|high",
    "durationEstimate": 8,
    "soundSuggestion": "ambient sounds for this scene",
    "musicSuggestion": "music style for this scene"
  }
]`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, characters = [], costPreference = "balanced" } = body as {
      storyText?: string;
      characters?: CharacterInput[];
      costPreference?: string;
      targetDuration?: string;
      projectId?: string;
    };

    if (!storyText || storyText.trim().length < 10) {
      return NextResponse.json({ error: "storyText is required" }, { status: 400 });
    }

    const prompt = buildPrompt(storyText, characters, costPreference);
    const llmResult = await callLLM(
      prompt,
      "You are a film scene planner. Return only valid JSON arrays. Be specific and visual in scene descriptions.",
      { role: "quality" as const, maxTokens: 4000, temperature: 0.6 }
    );

    if (!llmResult.ok) {
      return NextResponse.json({ error: `LLM call failed: ${llmResult.error}` }, { status: 502 });
    }

    // Parse response
    let scenes: unknown[] = [];
    try {
      const cleaned = llmResult.text.trim()
        .replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      scenes = Array.isArray(parsed) ? parsed : (parsed.scenes || []);
    } catch {
      const match = llmResult.text.match(/\[[\s\S]*\]/);
      if (match) {
        try { scenes = JSON.parse(match[0]); } catch { scenes = []; }
      }
    }

    if (scenes.length === 0) {
      return NextResponse.json({ error: "No scenes could be parsed from LLM response", rawResponse: llmResult.text.slice(0, 300) }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      scenes,
      sceneCount: scenes.length,
      provider: (llmResult as { provider?: string }).provider ?? "llm",
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scene-plan] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
