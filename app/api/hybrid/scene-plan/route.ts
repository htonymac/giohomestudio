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
import { buildFullLock } from "@/lib/era-culture-lock";

interface CharacterInput {
  characterId: string;
  displayName: string;
  role: string;
  ageRange?: string;
  gender?: string;
  skinTone?: string;
  visualDescription?: string;
}

function buildCharacterLine(c: CharacterInput): string {
  // Build a compact identity line so the LLM knows exactly who each character is visually.
  // Example output: "Baba Sule (protagonist) — adult male, dark skin tone. Traditional Nigerian village elder."
  const parts: string[] = [];
  if (c.ageRange && c.ageRange !== "unknown") parts.push(c.ageRange);
  if (c.gender && c.gender !== "unknown") parts.push(c.gender);
  if (c.skinTone) parts.push(`${c.skinTone} skin`);
  const identity = parts.length > 0 ? ` — ${parts.join(", ")}` : "";
  const desc = c.visualDescription ? `. ${c.visualDescription}` : "";
  return `- ${c.displayName} (${c.role})${identity}${desc}`;
}

// targetDuration arrives as a NUMBER of seconds (children planner) or a picker
// STRING like "2-3 min" / "10+ min" / "5s" (hybrid planner legacy). Normalize.
function normalizeDurationSeconds(v: unknown): number {
  if (typeof v === "number" && isFinite(v) && v > 0) return Math.round(v);
  if (typeof v !== "string") return 0;
  const s = v.toLowerCase().trim();
  const custom = s.match(/(\d+)\s*m\s*(\d+)?\s*s?/); // "custom:60m0s" shape
  if (s.includes("custom") && custom) return parseInt(custom[1]) * 60 + (custom[2] ? parseInt(custom[2]) : 0);
  const range = s.match(/(\d+)\s*-\s*(\d+)\s*min/);
  if (range) return Math.round(((parseInt(range[1]) + parseInt(range[2])) / 2) * 60);
  const mins = s.match(/(\d+)\s*\+?\s*min/);
  if (mins) return parseInt(mins[1]) * 60;
  const secs = s.match(/(\d+)\s*s(?:ec)?/);
  if (secs) return parseInt(secs[1]); // "5s" was a PER-SCENE picker value — treated as no total
  return 0;
}

// Duration-aware scene budget (Henry 2026-07-03): the old prompt hardcoded
// "Aim for 5-10 scenes" and NEVER read targetDuration — a 60-minute request
// collapsed to 5-10 scenes × ~8s ≈ 2 minutes. Now scene count scales with the
// requested duration (~1 scene per 40s, same rate story-expand uses) and each
// scene carries its share of the budget as durationEstimate. Cap 40 scenes so
// the JSON stays within LLM output limits; long videos get longer scenes.
function sceneBudget(durSec: number): { count: number; perScene: number } | null {
  if (!durSec || durSec < 60) return null; // shorts keep the LLM's own judgment
  const count = Math.min(40, Math.max(4, Math.round(durSec / 40)));
  return { count, perScene: Math.max(5, Math.round(durSec / count)) };
}

function buildPrompt(storyText: string, characters: CharacterInput[], costPreference: string, genre?: string, tone?: string, eraContext?: string, budget?: { count: number; perScene: number } | null): string {
  const charList = characters.length > 0
    ? characters.map(buildCharacterLine).join("\n")
    : "- No named characters yet";

  const genreBlock = genre ? `\nGENRE / STYLE: ${genre}` : "";
  const toneBlock = tone ? `\nTONE: ${tone}` : "";
  const eraBlock = eraContext ? `\n\n${eraContext}` : "";

  return `You are a professional film scene planner for an AI animation studio.

Read the following story carefully and break it into individual scenes. Each scene is one distinct moment, location, or beat.

STORY:
"""
${storyText.slice(0, budget ? 30000 : 8000)}
"""

CHARACTERS:
${charList}

COST PREFERENCE: ${costPreference || "balanced"}${genreBlock}${toneBlock}${eraBlock}

${genre ? `IMPORTANT: All scene descriptions, locations, clothing, and visual details MUST reflect the "${genre}" genre. Use culturally authentic settings, fashion, and context appropriate to this genre. Do NOT default to generic or Western settings if the genre implies a specific cultural context.` : ""}

Rules:
${budget
    ? `- TARGET RUNTIME: this video must run ~${Math.round((budget.count * budget.perScene) / 60)} minutes. Produce ${budget.count} scenes covering the FULL story/script — do not merge, skip, or summarize sections to fit fewer scenes. Set each scene's durationEstimate to ~${budget.perScene} (seconds); vary ±30% by weight but the TOTAL of all durationEstimate values must be close to ${budget.count * budget.perScene}.`
    : `- Aim for 5-10 scenes depending on story length`}
- Each scene gets a sceneType based on what it needs:
  * image-led: static image + narration (establishing shots, emotional moments, dialogue)
  * video-led: full motion needed (chase, fight, physical action)
  * image-to-video: starts still, gains motion (calm escalating to action)
  * audio-bridge: sound/narration only, no visual (time jumps, transitions)
  * hybrid: mix of still and motion within the scene
- Use the character IDs from the list above in characterIds
- description must be an ACTION-FIRST visual sentence describing what is HAPPENING in this scene (AI uses this directly for image generation)
- CRITICAL ACTION RULE (Henry 2026-06-13): every description MUST be built around a specific PHYSICAL ACTION VERB — running, leaping, lunging, ducking, swinging, grabbing, blocking, falling, hurling, dodging, climbing, reaching. NEVER write "stands", "stands firm", "looks at", "scanning", "gathers", "poses", or any static/idle phrasing. Capture the character MID-MOTION at the most dramatic instant of the beat. A fight scene shows a strike landing; a chase shows legs mid-stride and the pursuer closing; a discovery shows the body recoiling in shock. Show reaction and emotion through the body, not a calm pose.
- CRITICAL CHARACTER RULE: name the character by their EXACT name (so the image engine can resolve them) — but DO NOT write out their age, skin tone, or hair in the description. Those come from the character database automatically and are injected separately; repeating them here only crowds out the action and leaks into narration. Write "Bryan vaults the fallen log, fists clenched" — NOT "Bryan, a ten-year-old boy with warm brown skin and dark hair, stands by a log." Never write a bare "a man" or "he" — always the name.
- CRITICAL DOER/RECEIVER RULE (Henry 2026-06-16): for any action where ONE character acts ON another ("X handcuffs Y", "X tackles Y", "X grabs Y"), make the ROLES unmistakable by also describing the RECEIVER's resulting STATE — not just the verb. The image model often swaps who-does-what; describing the receiver's body fixes it. Write "Mara clamps handcuffs onto Cobra's wrists; Cobra's hands are locked behind his back, Mara standing over him in control" — NOT the ambiguous "Mara handcuffs Cobra". Always: the DOER is active/dominant, the RECEIVER is shown in the resulting position (cuffed, pinned, caught, falling).
- If cost preference is "efficient", prefer image-led. If "premium", use more video-led.
- CRITICAL: Use the EXACT character names from the CHARACTERS list above in your scene descriptions and titles. Never rename characters or refer to them as "the villain" or "the hero" when a name is given.
- CRITICAL: Do NOT combine characters who are separate individuals into a group. If "Vex" is one character and "Bryan" is another, they appear separately unless the story says they're together.
- Scene titles must name a specific story event (e.g. "Vex Breaks Into the System", "Bryan's Last Stand"), not generic labels (e.g. "Scene 3", "The Confrontation").
- Scenes must follow the story's actual narrative order — do not invent new plot beats or skip major story events.
- Scene descriptions describe the ACTION + the environment + the emotion — use character names and culturally authentic locations from the story. Lead with the verb, not the appearance.

Return ONLY a valid JSON array, no markdown:
[
  {
    "sceneId": "SC01",
    "title": "Short scene title",
    "description": "ACTION-FIRST visual description — what the character is DOING mid-motion (e.g. 'Bryan sprints between the trees, swinging a glowing branch at the lunging monster'). Name the character; never their age/skin/hair; never 'stands' or 'looks at'.",
    "location": "Where the scene takes place",
    "timeOfDay": "morning|afternoon|evening|night|dawn|dusk",
    "mood": "tense|calm|joyful|sad|mysterious|dramatic|hopeful|dark|comedic",
    "sceneType": "image-led|video-led|image-to-video|audio-bridge|hybrid",
    "characterIds": ["CH01", "CH02"],
    "narrationIntensity": "low|medium|high",
    "dialogueDensity": "low|medium|high",
    "emotionalWeight": "low|medium|high",
    "durationEstimate": ${budget ? budget.perScene : 8},
    "soundSuggestion": "ambient sounds for this scene",
    "musicSuggestion": "music style for this scene"
  }
]`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, characters = [], costPreference = "balanced", genre, tone, storyEra, storyCulture, targetDuration } = body as {
      storyText?: string;
      characters?: CharacterInput[];
      costPreference?: string;
      targetDuration?: string | number;
      projectId?: string;
      genre?: string;
      tone?: string;
      storyEra?: string;
      storyCulture?: string;
    };

    if (!storyText || storyText.trim().length < 10) {
      return NextResponse.json({ error: "storyText is required" }, { status: 400 });
    }

    const eraLock = buildFullLock(storyEra || "", storyCulture || "", genre || "");
    // Duration-aware plan (Henry 2026-07-03): honor the requested runtime.
    const durSec = normalizeDurationSeconds(targetDuration);
    const budget = sceneBudget(durSec);
    if (budget) console.log(`[scene-plan] duration-aware: ${durSec}s → ${budget.count} scenes × ~${budget.perScene}s`);
    const prompt = buildPrompt(storyText, characters, costPreference, genre, tone, eraLock.sceneContext || undefined, budget);
    const llmResult = await callLLM(
      prompt,
      "You are a film scene planner. Return only valid JSON arrays. Be specific and visual in scene descriptions.",
      // 40 scenes of JSON don't fit in 4000 tokens — scale output room with the plan.
      { role: "quality" as const, maxTokens: budget ? Math.max(4000, budget.count * 300) : 4000, temperature: 0.6 }
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
