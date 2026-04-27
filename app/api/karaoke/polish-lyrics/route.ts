// POST /api/karaoke/polish-lyrics
// Body: { recordingId?, currentLyrics, interventionLevel, subAction?, analysis? }
// §11 — 5 intervention levels. Option 1 ALWAYS = user's exact original line.
// §25 — Safety: never change core meaning, default level = improve (lightest).
// Uses Claude Haiku 4.5

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// §11 intervention levels — user picks level FIRST
export type InterventionLevel =
  | "improve"       // light vocabulary upgrade, keep flow
  | "simplify"      // make accessible, shorter words, clearer meaning
  | "strengthen"    // emotional intensity up, keep flow + meaning
  | "rewrite_light" // rewrite while preserving meaning + style
  | "rewrite_full"  // fuller rewrite while preserving the user's idea/intent

// Optional sub-action the user can add after picking level
export type SubAction =
  | "pidgin"
  | "gospel"
  | "yoruba"
  | "children_safe"
  | "poetic"
  | null;

interface PolishRequest {
  recordingId?: string;
  currentLyrics: string;
  interventionLevel?: InterventionLevel;
  // Legacy field — if old action string is sent, we map it
  action?: string;
  subAction?: SubAction;
  freeformInstruction?: string;
  analysis?: { tempo: number; key: string; mood: string; genre: string };
}

interface LyricOption {
  label: string;
  lyrics: string;
  rationale: string;
  isOriginal?: boolean;
}

function countSyllables(text: string): number {
  const matches = text.match(/[aeiouy]+/gi);
  return matches ? matches.length : 0;
}

function detectRhymeScheme(lines: string[]): string {
  const lastWords = lines.map((l) => {
    const words = l.trim().split(/\s+/);
    return words[words.length - 1]?.replace(/[^a-zA-Z]/g, "").toLowerCase() || "";
  });

  const schemeMap: Record<string, string> = {};
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let letterIdx = 0;
  const scheme: string[] = [];

  for (const word of lastWords) {
    if (!word) { scheme.push("X"); continue; }
    const ending = word.slice(-3);
    let matched = false;
    for (const [existing, letter] of Object.entries(schemeMap)) {
      const existEnding = existing.slice(-3);
      if (existEnding === ending && existEnding.length >= 2) {
        scheme.push(letter);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const newLetter = letters[letterIdx] || "?";
      schemeMap[word] = newLetter;
      scheme.push(newLetter);
      letterIdx++;
    }
  }

  return scheme.join("");
}

function interventionDescription(level: InterventionLevel): string {
  const map: Record<InterventionLevel, string> = {
    improve:
      "Light vocabulary upgrade only. Swap weak or vague words for stronger, more vivid ones. Keep the same rhythm, meaning, and sentence structure. This is the gentlest change.",
    simplify:
      "Make the lyrics more accessible. Use shorter, clearer words. Simplify complex phrasing. Keep the same core meaning but make it easier to understand and sing.",
    strengthen:
      "Turn up the emotional intensity. Make the feeling stronger — more urgent, more powerful, more moving. Preserve the original flow and meaning.",
    rewrite_light:
      "Rewrite while preserving the writer's meaning and style. You can restructure sentences and find better phrasing, but keep the core story/emotion and the cultural grounding.",
    rewrite_full:
      "Fuller creative rewrite. Preserve the writer's original idea and intent, but you can rebuild the line significantly. Keep Nigerian/cultural grounding. Still must not change what the song is fundamentally about.",
  };
  return map[level];
}

function subActionDescription(subAction: SubAction): string {
  if (!subAction) return "";
  const map: Record<NonNullable<SubAction>, string> = {
    pidgin: " Additionally, lean into authentic Nigerian Pidgin English expressions and phrasing.",
    gospel: " Additionally, add a gospel/spiritual/praise energy to the language.",
    yoruba: " Additionally, incorporate Yoruba language or Yoruba/English code-switching.",
    children_safe: " Additionally, use simple, child-friendly, age-appropriate language.",
    poetic: " Additionally, use poetic devices — metaphors, imagery, and figurative language.",
  };
  return map[subAction] ?? "";
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body: PolishRequest = await req.json();
    const {
      currentLyrics,
      interventionLevel = "improve", // §25 default = lightest
      subAction = null,
      freeformInstruction,
      analysis,
    } = body;

    if (!currentLyrics) {
      return NextResponse.json({ error: "currentLyrics is required" }, { status: 400 });
    }

    const level: InterventionLevel = interventionLevel;
    const analysisContext = analysis
      ? `\nRecording context: ${analysis.tempo} BPM, Key ${analysis.key}, Mood ${analysis.mood}, Genre ${analysis.genre}`
      : "";

    const levelDesc = interventionDescription(level);
    const subDesc = subAction ? subActionDescription(subAction) : "";
    const freeformNote = freeformInstruction ? `\nAdditional user instruction: ${freeformInstruction}` : "";

    // §11 + §25 — strict system prompt
    const systemPrompt = `You are a professional Nigerian music lyricist inside GHS Karaoke Studio.
You understand Afrobeats, Highlife, Gospel, R&B, Hip Hop, and authentic Nigerian expression.
You write in English, Pidgin, Yoruba, Igbo, and code-switching mixes.

HARD RULES — follow these exactly:
1. NEVER overwrite the user's original line — Option 1 MUST always be the user's exact original line, word-for-word, unchanged.
2. Always return EXACTLY 5 options. Option 1 = original. Options 2-5 = alternatives at the chosen intervention level.
3. Never change the core meaning of the lyrics. The user's idea is sacred.
4. Preserve the original mood, feeling, and Nigerian/cultural grounding.
5. Never return generic or random lyrics that don't match the original theme.
6. Return ONLY valid JSON — no markdown, no explanation outside the JSON.`;

    const userPrompt = `Lyrics to work on:
---
${currentLyrics}
---

Intervention level: ${level.toUpperCase()}
What this means: ${levelDesc}${subDesc}${freeformNote}${analysisContext}

Return exactly 5 options as JSON:
{
  "options": [
    {
      "label": "Your line",
      "lyrics": "${currentLyrics.replace(/"/g, '\\"').slice(0, 200)}",
      "rationale": "Your original line — kept exactly as you wrote it.",
      "isOriginal": true
    },
    {
      "label": "descriptive label for option 2",
      "lyrics": "alternative version 2",
      "rationale": "one sentence explaining what changed and why"
    },
    {
      "label": "descriptive label for option 3",
      "lyrics": "alternative version 3",
      "rationale": "one sentence explaining what changed and why"
    },
    {
      "label": "descriptive label for option 4",
      "lyrics": "alternative version 4",
      "rationale": "one sentence explaining what changed and why"
    },
    {
      "label": "descriptive label for option 5",
      "lyrics": "alternative version 5",
      "rationale": "one sentence explaining what changed and why"
    }
  ]
}

IMPORTANT: Option 1 must be the exact original text unchanged. Options 2-5 must follow the ${level} intervention level. Return ONLY the JSON.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Claude returned no JSON", raw }, { status: 500 });
    }

    let parsed: { options: LyricOption[] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude JSON response", raw }, { status: 500 });
    }

    if (!parsed.options || !Array.isArray(parsed.options)) {
      return NextResponse.json({ error: "Malformed response from Claude", parsed }, { status: 500 });
    }

    // §11 safety net: enforce Option 1 = original line regardless of what Claude returned
    if (parsed.options.length > 0) {
      parsed.options[0] = {
        label: "Your line",
        lyrics: currentLyrics,
        rationale: "Your original line — kept exactly as you wrote it.",
        isOriginal: true,
      };
    }

    // Compute syllable counts and rhyme scheme for the ORIGINAL lyrics
    const lines = currentLyrics.split(/[.\n,!?]+/).map((l) => l.trim()).filter(Boolean);
    const syllableCounts = lines.map(countSyllables);
    const rhymeScheme = detectRhymeScheme(lines);

    return NextResponse.json({
      options: parsed.options,
      syllableCounts,
      rhymeScheme,
      interventionLevel: level,
      subAction,
    });
  } catch (err) {
    console.error("[karaoke/polish-lyrics] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Polish request failed" },
      { status: 500 }
    );
  }
}
