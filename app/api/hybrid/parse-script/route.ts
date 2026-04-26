// POST /api/hybrid/parse-script
// Splits a story text into narrator + character dialogue segments.
// Returns: storyMode, segments[], detectedSpeakers[]
//
// storyMode:
//   "narration-only"  — no dialogue found, one narrator speaks throughout
//   "actors-only"     — only quoted speech, no narration passages
//   "mixed"           — narrator describes, characters speak their lines (most stories)
//
// Each segment:
//   { id, type: "narration"|"dialogue", speaker: "narrator"|charName, text, lineIndex }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export interface ScriptSegment {
  id: string;
  type: "narration" | "dialogue";
  speaker: string;   // "narrator" or character display name
  text: string;
  lineIndex: number;
}

export type StoryMode = "narration-only" | "actors-only" | "mixed";

// ── Regex-based fast parser (no LLM needed) ──────────────────────────────────
// Handles the most common patterns before falling back to LLM.
const DIALOGUE_PATTERNS = [
  // "text," speaker said/replied/etc.
  /["'""]([^"""']+)["'""][,.]?\s+([\w\s]+?)\s+(said|replied|asked|cried|shouted|whispered|muttered|answered|called|yelled|laughed|sighed)/gi,
  // speaker said/replied "text"
  /([\w\s]+?)\s+(said|replied|asked|cried|shouted|whispered|muttered|answered|called|yelled)\s*[,:]?\s*["'""]([^"""']+)["'""]/gi,
  // "text" — just quoted speech
  /["'""]([^"""']{3,}?)["'""]/g,
];

function fastParse(text: string): { segments: ScriptSegment[]; mode: StoryMode } {
  const lines = text.split(/\n+/).filter(l => l.trim().length > 2);
  const segments: ScriptSegment[] = [];
  let dialogueCount = 0;
  let narrationCount = 0;
  const speakers = new Set<string>();

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Check if line contains quoted speech
    const quoteMatch = trimmed.match(/["'""]([^"""']+)["'""]/);
    if (quoteMatch) {
      dialogueCount++;
      // Try to find speaker attribution
      const attrMatch = trimmed.match(
        /["'""][^"""']+["'""][,.]?\s+([\w]+)\s+(?:said|replied|asked|cried|shouted|whispered|muttered|answered|called|yelled)/i
      ) || trimmed.match(
        /([\w]+)\s+(?:said|replied|asked|cried|shouted|whispered|muttered|answered|called|yelled)[,:]?\s*["'""]/i
      );
      const speaker = attrMatch ? attrMatch[1] : "Character";
      speakers.add(speaker);

      // Split: narration part before/after quote + dialogue
      const beforeQuote = trimmed.split(/["'""]/)[0].trim();
      const afterQuote = trimmed.split(/["'""][^"""']+["'""]/)[1]?.trim() || "";

      if (beforeQuote && beforeQuote.length > 3) {
        segments.push({ id: `seg_${idx}_n`, type: "narration", speaker: "narrator", text: beforeQuote, lineIndex: idx });
        narrationCount++;
      }
      segments.push({ id: `seg_${idx}_d`, type: "dialogue", speaker, text: quoteMatch[1].trim(), lineIndex: idx });
      if (afterQuote && afterQuote.length > 3 && !/^(said|replied|asked|cried|shouted|whispered)/i.test(afterQuote)) {
        segments.push({ id: `seg_${idx}_n2`, type: "narration", speaker: "narrator", text: afterQuote, lineIndex: idx });
        narrationCount++;
      }
    } else {
      // Pure narration line
      narrationCount++;
      segments.push({ id: `seg_${idx}_n`, type: "narration", speaker: "narrator", text: trimmed, lineIndex: idx });
    }
  });

  const mode: StoryMode =
    dialogueCount === 0 ? "narration-only" :
    narrationCount === 0 ? "actors-only" :
    "mixed";

  return { segments, mode };
}

// ── LLM-enhanced parser (better speaker detection) ────────────────────────────
function buildParsePrompt(storyText: string, knownCharacters: string[]): string {
  return `You are a script supervisor for an AI film studio.

Story text:
"""
${storyText.slice(0, 4000)}
"""

Known characters: ${knownCharacters.length > 0 ? knownCharacters.join(", ") : "unknown — detect from text"}

Split this story into an ordered array of segments. Each segment is either:
- "narration": descriptive text that a narrator would read aloud
- "dialogue": words spoken directly by a character

Rules:
1. Quoted speech (" ") is ALWAYS dialogue — attribute to the speaker if you can tell who it is
2. Everything outside quotes (descriptions, actions, scene setting) is narration
3. Dialogue attribution tags like "he said", "Ada replied" belong to the narration layer, not the dialogue
4. If a speaker cannot be identified, use "Unknown"
5. Keep each segment's text clean — strip attribution tags from dialogue text

Return ONLY a valid JSON object, no markdown:
{
  "storyMode": "narration-only" | "actors-only" | "mixed",
  "segments": [
    { "id": "s1", "type": "narration", "speaker": "narrator", "text": "...", "lineIndex": 0 },
    { "id": "s2", "type": "dialogue", "speaker": "Ada", "text": "Help me!", "lineIndex": 1 },
    ...
  ]
}`;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, knownCharacters = [] } = body as {
      storyText?: string;
      knownCharacters?: string[];
    };

    if (!storyText || storyText.trim().length < 10) {
      return NextResponse.json({ error: "storyText is required" }, { status: 400 });
    }

    // Fast parse first — LLM enhances speaker attribution
    const fast = fastParse(storyText);

    // Try LLM for better speaker attribution
    const prompt = buildParsePrompt(storyText, knownCharacters);
    const llmResult = await callLLM(
      prompt,
      "You are a script supervisor. Return only valid JSON. No markdown.",
      { role: "quality" as const, maxTokens: 3000, temperature: 0.3 }
    );

    if (llmResult.ok) {
      try {
        const cleaned = llmResult.text.trim()
          .replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.segments && Array.isArray(parsed.segments)) {
          return NextResponse.json({
            ok: true,
            storyMode: parsed.storyMode || fast.mode,
            segments: parsed.segments as ScriptSegment[],
            provider: (llmResult as { provider?: string }).provider ?? "llm",
          });
        }
      } catch { /* fall through to fast parse result */ }
    }

    // Return fast parse result
    return NextResponse.json({
      ok: true,
      storyMode: fast.mode,
      segments: fast.segments,
      provider: "regex",
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parse-script] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
