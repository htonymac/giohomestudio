// POST /api/hybrid/structure-story
// Pre-expansion step for Hybrid mode.
// Takes a raw story idea and rewrites it as a tagged visual script so that
// images carry the emotional/action weight instead of narration alone.
//
// Tags produced: [VISUAL] [ACTION] [BEAT] [DIALOGUE] [NARRATION] [TRANSITION] [ESTABLISH]
// Scene demarcator and prompt builder both read these tags downstream.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

interface StructureStoryRequest {
  storyIdea: string;
  storyType?: string;
  genre?: string;
  tone?: string;
  country?: string;
  targetDuration?: number;
  provider?: string;
}

interface StructuredScene {
  tag: "VISUAL" | "ACTION" | "BEAT" | "DIALOGUE" | "NARRATION" | "TRANSITION" | "ESTABLISH";
  description: string;        // what happens in this moment
  speakingCharacter?: string; // for DIALOGUE only
  dialogueLine?: string;      // for DIALOGUE only
  narrationText?: string;     // for NARRATION only — what narrator says over image
  imageIntent: string;        // one-line: what the image MUST show (feeds prompt builder)
  durationHint: number;       // estimated seconds for this moment
}

interface StructureStoryResult {
  structuredScenes: StructuredScene[];
  totalEstimatedDuration: number;
  tagBreakdown: {
    VISUAL: number;
    ACTION: number;
    BEAT: number;
    DIALOGUE: number;
    NARRATION: number;
    TRANSITION: number;
    ESTABLISH: number;
  };
  cinematicNotes: string;   // AI's note on how visuals carry this story
}

function isValidResult(obj: unknown): obj is StructureStoryResult {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.structuredScenes) && o.structuredScenes.length > 0;
}

function extractJSON(raw: string): unknown | null {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch { /* continue */ } }
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s !== -1 && e > s) { try { return JSON.parse(cleaned.slice(s, e + 1)); } catch { /* continue */ } }
  return null;
}

const SYSTEM = `You are GHS Visual Script Architect — a cinematic story structurer for AI video production.

Your job: take a story idea and break it into a sequence of visual moments tagged by type.
Each moment becomes either an image, an action shot, an emotional pause, dialogue, or narration.

RULES:
- Images must CARRY the story — emotions, actions, drama should be SHOWN not told
- Keep NARRATION tags short — narrator only speaks when image can't carry the moment alone
- BEAT tags are silence/reaction moments — no words, pure emotion in the image
- ESTABLISH must be the first tag unless story starts mid-action (then first tag = ACTION)
- DIALOGUE: only use when a character SPEAKS in the story — include exact dialogue line
- Total tagged scenes should match target duration (roughly 3-5s per scene on average)
- imageIntent must be SPECIFIC: "close-up of John's tear-streaked face as fire rages behind him" NOT "emotional scene"

VALID TAGS:
- ESTABLISH: first shot of a new location — wide, sets the environment
- VISUAL: key moment that must be shown — no narration, image tells the story
- ACTION: physical movement — chase, jump, fight, run, collapse
- BEAT: emotional pause — reaction, realization, silence, tension
- DIALOGUE: character speaks — include exact line
- NARRATION: narrator speaks over image — image must still be meaningful
- TRANSITION: scene/time change — bridge between locations or time periods

Return ONLY valid JSON, no explanation:
{
  "structuredScenes": [
    {
      "tag": "ESTABLISH",
      "description": "what is happening in this moment",
      "imageIntent": "specific image the AI must generate — be cinematic and precise",
      "durationHint": 3,
      "narrationText": null,
      "speakingCharacter": null,
      "dialogueLine": null
    }
  ],
  "totalEstimatedDuration": 60,
  "tagBreakdown": {"VISUAL":0,"ACTION":0,"BEAT":0,"DIALOGUE":0,"NARRATION":0,"TRANSITION":0,"ESTABLISH":0},
  "cinematicNotes": "One sentence on how visuals carry this specific story"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StructureStoryRequest;

    if (!body.storyIdea?.trim()) {
      return NextResponse.json({ ok: false, error: "storyIdea required" }, { status: 400 });
    }

    const durSec = body.targetDuration || 120;
    const estScenes = Math.max(6, Math.round(durSec / 4));

    const lines: string[] = [`Story idea: "${body.storyIdea.trim()}"`];
    if (body.genre) lines.push(`Genre: ${body.genre}`);
    if (body.tone) lines.push(`Tone: ${body.tone}`);
    if (body.storyType) lines.push(`Story type: ${body.storyType.replace(/_/g, " ")}`);
    if (body.country) lines.push(`Setting/country: ${body.country}`);
    lines.push(`Target duration: ${durSec} seconds → aim for ~${estScenes} tagged scenes`);
    lines.push(`Make images carry emotions and action. Keep NARRATION scenes short.`);

    const userMsg = lines.join("\n");

    const llmResult = await callLLM(userMsg, SYSTEM, {
      role: "fast",
      temperature: 0.7,
      maxTokens: 4000,
    });

    if (!llmResult.ok) {
      return NextResponse.json({ ok: false, error: `AI unavailable: ${llmResult.error}` }, { status: 503 });
    }

    const parsed = extractJSON(llmResult.text);
    if (!isValidResult(parsed)) {
      console.warn("[structure-story] Bad AI response:", llmResult.text.slice(0, 300));
      return NextResponse.json({ ok: false, error: "AI returned invalid structure. Try again." }, { status: 422 });
    }

    // Ensure tag breakdown is filled from actual scenes if AI omitted it
    const breakdown = { VISUAL: 0, ACTION: 0, BEAT: 0, DIALOGUE: 0, NARRATION: 0, TRANSITION: 0, ESTABLISH: 0 };
    for (const scene of parsed.structuredScenes) {
      if (scene.tag in breakdown) breakdown[scene.tag as keyof typeof breakdown]++;
    }

    return NextResponse.json({
      ok: true,
      structuredScenes: parsed.structuredScenes,
      totalEstimatedDuration: parsed.totalEstimatedDuration || durSec,
      tagBreakdown: breakdown,
      cinematicNotes: parsed.cinematicNotes || "",
      provider: (llmResult as { provider: string }).provider,
    });
  } catch (err) {
    console.error("[structure-story] error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
