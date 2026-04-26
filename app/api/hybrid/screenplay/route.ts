// POST /api/hybrid/screenplay
// Takes story data from the Hybrid Planner and writes a full professional movie screenplay.
// Format: standard Hollywood spec script — scene headings, action lines, dialogue blocks.
// Studio: GIO HOME AI STUDIO · Owner: [user-entered name]

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

// Allow up to 90s for screenplay generation
export const maxDuration = 90;

interface ScreenplayRequest {
  title: string;
  summary: string;
  fullScript?: string;
  characters: Array<{
    displayName: string;
    species?: string;
    roleType: string;
    gender: string;
    ageRange?: string;
    speechStyle?: string;
    colorDescription?: string;
    clothingDetails?: string;
  }>;
  scenes: Array<{
    sceneId: string;
    title: string;
    description: string;
    location?: string;
    timeOfDay?: string;
    mood?: string;
    narrationScript?: string;
  }>;
  genre?: string;
  tone?: string;
  projectStyle?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ScreenplayRequest;

    if (!body.summary && !body.fullScript) {
      return NextResponse.json({ ok: false, error: "Story summary is required. Expand your story first." }, { status: 400 });
    }

    // Build compact character block — keep it short to save tokens
    const characterBlock = (body.characters || []).slice(0, 8).map(c => {
      const visual = [c.species, c.colorDescription, c.clothingDetails].filter(Boolean).join(", ");
      return `- ${c.displayName.toUpperCase()} (${c.roleType}, ${c.gender}${c.ageRange ? ", " + c.ageRange : ""})${visual ? ": " + visual : ""}${c.speechStyle ? " — speaks " + c.speechStyle : ""}`;
    }).join("\n");

    // Build compact scene block — cap narration note to 80 chars
    const sceneBlock = (body.scenes || []).slice(0, 12).map((s, i) => {
      const note = s.narrationScript ? ` [${s.narrationScript.slice(0, 80)}]` : "";
      return `${i + 1}. ${s.title}${s.location ? " — " + s.location : ""}${s.timeOfDay ? ", " + s.timeOfDay : ""}${s.mood ? " (" + s.mood + ")" : ""}${note}`;
    }).join("\n");

    // Use summary over fullScript — shorter = faster, still complete
    const storySource = (body.summary || body.fullScript || "").slice(0, 800);

    const systemPrompt = `You are a professional screenplay writer. Write ONLY the screenplay — no preamble, no explanation, no title page. Start with FADE IN: and end with FADE OUT. followed by THE END.`;

    const userPrompt = `Write a professional movie screenplay.

TITLE: ${(body.title || "UNTITLED").slice(0, 60)}
GENRE: ${body.genre || "Adventure"} | TONE: ${body.tone || "Family"}

STORY:
${storySource}

CHARACTERS:
${characterBlock || "- HERO (protagonist)\n- VILLAIN (antagonist)"}

SCENES TO COVER:
${sceneBlock || "1. Opening\n2. Rising action\n3. Climax\n4. Resolution"}

FORMAT RULES:
- Scene headings: INT./EXT. LOCATION — DAY/NIGHT (all caps)
- Action lines: short, present tense, what we SEE
- Character name before dialogue: ALL CAPS centered
- Dialogue: natural, each character has a distinct voice
- Use (beat), (quietly), (laughing) parentheticals where needed
- Transitions: CUT TO: between scenes, FADE OUT. at the end

Write all scenes. Keep each scene tight. Start now with FADE IN:`;

    // Keep tokens low — Haiku at 3000 tokens writes a full ~1500-word screenplay in ~15s
    const sceneCount = Math.min((body.scenes || []).length, 12);
    const maxTokens = Math.min(3500, Math.max(1800, sceneCount * 220 + 500));

    const result = await callLLM(userPrompt, systemPrompt, {
      role: "fast",        // Haiku — 10× faster than Sonnet, still great for screenplay
      temperature: 0.75,
      maxTokens,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: `AI unavailable: ${result.error}. Check your API key in Settings.`,
      }, { status: 503 });
    }

    let screenplay = result.text.trim();
    // Strip markdown fences if AI added them
    screenplay = screenplay.replace(/^```(?:screenplay|text)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    return NextResponse.json({
      ok: true,
      screenplay,
      provider: (result as { provider?: string }).provider,
    });

  } catch (err) {
    console.error("[screenplay] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Screenplay generation failed" },
      { status: 500 }
    );
  }
}
