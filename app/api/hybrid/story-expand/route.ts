// GioHomeStudio — Hybrid Pipeline Step 2: Story Intelligence Expansion
//
// Takes user story input + optional controls and uses cloud LLM to expand
// into a structured production plan for hybrid video creation.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

// ── Types ────────────────────────────────────────────────────────

interface StoryExpandRequest {
  storyInput: string;
  genre?: string;
  tone?: string;
  targetDuration?: number;   // seconds
  targetDurationLabel?: string; // human label e.g. "15 min"
  language?: string;
  costPreference?: "free" | "low" | "medium" | "high";
  audience?: string;
  provider?: string; // "auto" | "claude" | "openai" | "grok" | "ollama" | "claude:claude-opus-4-6" | "openai:o3-mini" etc.
  tier?: "free" | "standard" | "pro"; // GHS AI tier — maps to model selection
}

interface CharacterEntry {
  name: string;
  role: "hero" | "villain" | "narrator" | "support";
  description: string;
  age: string;
  gender: string;
  voiceStyle: string;
}

interface LocationEntry {
  name: string;
  description: string;
}

interface ExpandedStory {
  summary: string;
  fullScript?: string;       // complete narration script scaled to target duration
  tone: string;
  pacingDirection: string;
  worldLogic: string;
  emotionLogic: string;
  narrativeArc: string;
  characterList: CharacterEntry[];
  locationList: LocationEntry[];
  soundSuggestions: string[];
  moodSuggestions: string[];
  actionPeaks: string[];
  narrationHeavyAreas: string[];
}

// ── Deterministic fallback ───────────────────────────────────────

function buildFallbackExpansion(input: StoryExpandRequest): ExpandedStory {
  return {
    summary: input.storyInput.slice(0, 300),
    tone: input.tone || "neutral",
    pacingDirection: "steady, building toward a climax in the final third",
    worldLogic: "realistic modern-day setting unless story suggests otherwise",
    emotionLogic: "gradual emotional escalation from curiosity to resolution",
    narrativeArc: "setup - rising tension - climax - resolution",
    characterList: [
      {
        name: "Protagonist",
        role: "hero",
        description: "The main character driving the story forward",
        age: "adult",
        gender: "unspecified",
        voiceStyle: "confident and warm",
      },
    ],
    locationList: [
      {
        name: "Primary Location",
        description: "The main setting where the story unfolds",
      },
    ],
    soundSuggestions: ["ambient background", "subtle tension cue", "resolution chime"],
    moodSuggestions: ["curiosity", "tension", "relief"],
    actionPeaks: ["midpoint confrontation", "climax moment"],
    narrationHeavyAreas: ["opening introduction", "emotional turning point"],
  };
}

// ── JSON extraction helper ───────────────────────────────────────
// Strips AI reasoning blocks (<think>...</think>, <analysis>...</analysis>)
// before extracting JSON — so reasoning-first prompts still parse cleanly.

function stripReasoningBlocks(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
}

function extractJSON(raw: string): unknown | null {
  const cleaned = stripReasoningBlocks(raw);

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // ignore
  }

  // Try to find JSON block in markdown fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // ignore
    }
  }

  // Try to find first { ... } block
  const braceStart = cleaned.indexOf("{");
  const braceEnd = cleaned.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
    } catch {
      // ignore
    }
  }

  return null;
}

// ── Validation helper ────────────────────────────────────────────

function isValidExpansion(obj: unknown): obj is ExpandedStory {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.summary === "string" &&
    typeof o.tone === "string" &&
    Array.isArray(o.characterList) &&
    Array.isArray(o.locationList)
  );
}

// ── POST handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StoryExpandRequest;

    if (!body.storyInput || typeof body.storyInput !== "string" || !body.storyInput.trim()) {
      return NextResponse.json(
        { ok: false, error: "storyInput is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // ── Duration → word count calculation ──────────────────────────────────
    // Average narration speed ≈ 130 words/min.
    // For movie time = narration + actor dialogue combined.
    const durSec = body.targetDuration || 120; // default 2 min
    const durMin = durSec / 60;
    const targetWordCount = Math.round(durMin * 130); // ~130 wpm
    const targetSceneCount = Math.max(3, Math.round(durMin * 1.5)); // ~1.5 scenes/min

    // Build the user prompt with all optional controls
    const controlLines: string[] = [];
    if (body.genre) controlLines.push(`Genre: ${body.genre}`);
    if (body.tone) controlLines.push(`Desired tone: ${body.tone}`);
    if (body.targetDurationLabel) controlLines.push(`Target movie length: ${body.targetDurationLabel} (${durSec} seconds)`);
    if (body.language) controlLines.push(`Language: ${body.language}`);
    if (body.costPreference) controlLines.push(`Cost preference: ${body.costPreference}`);
    if (body.audience) controlLines.push(`Target audience: ${body.audience}`);

    const controlBlock = controlLines.length > 0
      ? `\n\nUser controls:\n${controlLines.join("\n")}`
      : "";

    const userPrompt = `A creator has given you this brief story idea:
"""
${body.storyInput.trim()}
"""${controlBlock}

You are going to turn this into a COMPLETE cinematic production. Here is what you must do:

━━ CHARACTERS ━━
Count every character the creator mentioned (explicitly or implied). Give EACH one:
- A memorable invented first name (e.g. "Benny", "Rex", "Zara" — never a generic label like "The Stranger" or "Character 1")
- A completely different species, body type, and colour from every other character
- A distinct personality that makes them unforgettable

For this story, the characters mentioned are: look carefully at the idea above and list ALL of them.

━━ SCRIPT ━━
Write a COMPLETE flowing narration script of approximately ${targetWordCount} words.
- Scene by scene, covering every plot beat from start to finish
- Written as a warm, engaging narrator would actually speak it aloud
- Use all character names you invented
- Cover the full ${Math.round(durMin)} minutes — DO NOT stop early or summarize

━━ STORY STRUCTURE ━━
Build approximately ${targetSceneCount} scenes across:
- Act 1 (setup): introduce characters and world warmly
- Act 2 (journey/conflict): rising tension, challenges, the antagonist threat
- Act 3 (climax + resolution): the peak moment and a satisfying emotional ending

Return ONLY this JSON — no explanation, no markdown fences:
{
  "summary": "2-3 sentences summarising the complete story using all invented character names",
  "fullScript": "The complete narration — approximately ${targetWordCount} words. Scene by scene. Every beat covered. Written as a narrator speaks. DO NOT TRUNCATE OR STOP EARLY.",
  "tone": "e.g. heartfelt adventure / warm comedy / dark thriller / whimsical family",
  "pacingDirection": "describe how pace builds across the story",
  "worldLogic": "describe the world's setting and feel",
  "emotionLogic": "how the audience's emotions move from start to finish",
  "narrativeArc": "Act 1: setup. Act 2: tension. Act 3: climax and resolution.",
  "characterList": [
    {
      "name": "invented name — required, never a placeholder",
      "role": "hero|villain|narrator|support",
      "description": "species + visual appearance + personality — must be DIFFERENT from all other characters",
      "age": "child / teen / young adult / adult / elder",
      "gender": "male|female|unknown",
      "voiceStyle": "e.g. warm and playful / deep and commanding / bright and energetic"
    }
  ],
  "locationList": [
    {
      "name": "location name",
      "description": "rich visual + sensory description of this place"
    }
  ],
  "soundSuggestions": ["specific sound effects and music cues"],
  "moodSuggestions": ["2-4 mood keywords for visual direction"],
  "actionPeaks": ["2-3 key high-intensity or emotionally charged moments by name"],
  "narrationHeavyAreas": ["scenes where narration carries the story"]
}`;

    const systemPrompt =
      "You are GHS Story Intelligence — a creative story director and screenwriter. When given a brief story idea, you develop it into a full cinematic production: you invent character names, make every character visually and emotionally distinct from the others, write a complete flowing narration script at the requested length, and build a structured narrative arc. You respond ONLY with valid JSON. No markdown. No preamble. No explanation. Never truncate the fullScript — always write the complete script. " +
      "CRITICAL RULE: Unless the story explicitly mentions animals or non-human creatures, all characters are HUMAN. " +
      "Do NOT default characters to bears, cartoon animals, or anthropomorphic creatures. " +
      "Human characters must have human anatomy, human skin tones, and human faces. " +
      "Only introduce animal characters when the story idea explicitly calls for them.";

    // Reasoning phase (~500 tokens) + full script + JSON overhead
    // thinking tags are stripped before parsing, but still count toward generation budget
    const maxTokens = Math.max(6000, Math.min(24000, targetWordCount * 2 + 1000));

    // Parse "provider:model" format e.g. "claude:claude-opus-4-6" or plain "claude"
    let forceProvider: string | undefined;
    let forceModel: string | undefined;
    if (body.provider && body.provider !== "auto") {
      const parts = body.provider.split(":");
      forceProvider = parts[0] as "claude" | "openai" | "grok" | "ollama";
      forceModel = parts[1]; // undefined if just "claude" with no model suffix
    }

    // GHS AI Tier routing: free → ollama, standard → haiku (fast), pro → sonnet (quality)
    const tier = body.tier as "free" | "standard" | "pro" | undefined;
    if (tier === "free" && !forceProvider)  { forceProvider = "ollama"; }
    if (tier === "standard" && !forceProvider) { forceModel = forceModel || "claude-haiku-4-5-20251001"; }
    if (tier === "pro" && !forceProvider)   { forceModel = forceModel || "claude-sonnet-4-6"; }

    // Use user-selected provider or auto (Claude → GPT → Grok → Ollama)
    const llmResult = await callLLM(userPrompt, systemPrompt, {
      role: tier === "pro" ? "quality" as const : "fast" as const,
      temperature: 0.7,
      maxTokens,
      forceProvider: forceProvider as "claude" | "openai" | "gpt" | "grok" | "ollama" | undefined,
      forceModel,
    });

    let expandedStory: ExpandedStory;

    if (llmResult.ok) {
      const parsed = extractJSON(llmResult.text);
      if (parsed && isValidExpansion(parsed)) {
        expandedStory = parsed;
      } else {
        // LLM returned something but it wasn't valid — log first 500 chars for debugging
        console.warn("[story-expand] LLM response failed JSON validation. Raw preview:", llmResult.text.slice(0, 500));
        // Return the raw text as an error so the caller can see what happened
        return NextResponse.json({
          ok: false,
          error: "AI returned a response but it could not be parsed as a story. Try again.",
          rawPreview: llmResult.text.slice(0, 300),
          provider: (llmResult as { provider: string }).provider,
        }, { status: 422 });
      }
    } else {
      // LLM call failed entirely — return a real error so the user knows to fix their API key
      console.warn(`[story-expand] All LLM providers failed: ${llmResult.error}`);
      return NextResponse.json({
        ok: false,
        error: `Story AI unavailable: ${llmResult.error}. Check your API key in Settings.`,
        provider: "none",
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      expandedStory,
      provider: (llmResult as { provider: string }).provider,
    });
  } catch (err) {
    console.error("[story-expand] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
