// POST /api/dialogue/parse
//
// Auto-tag speakers in unstructured dialogue text. Free Mode users paste
// something like:
//
//   Where are you? I'm right here. Don't worry, I'll be there soon.
//
// We use an LLM (Ollama → OpenAI → Claude Haiku fallback) to figure out which
// fragments belong to which speaker and return:
//
//   { lines: [
//     { speakerId: "Cast 1", text: "Where are you?" },
//     { speakerId: "Cast 2", text: "I'm right here." },
//     { speakerId: "Cast 1", text: "Don't worry, I'll be there soon." },
//   ] }
//
// The route is provider-agnostic via callLLM. Default provider chain:
//   ollama → openai → claude
// Caller can pass `provider` to force a single one.
//
// The LLM is also asked to suggest names for each cast slot when the user gives
// no hints (e.g. character context). Cast 1 / Cast 2 are the safe fallback.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

type Provider = "auto" | "ollama" | "openai" | "claude";

interface ParsedLine {
  speakerId: string;        // "Cast 1", "Cast 2", or a name if the LLM identified one
  text: string;
  emotion?: string;
}

interface ParseRequest {
  text: string;
  /**
   * Optional list of known speaker names ("Bryan", "Mia"). When passed the
   * LLM will prefer these labels over generic Cast 1 / Cast 2.
   */
  knownSpeakers?: string[];
  provider?: Provider;
}

function buildSystemPrompt(known: string[] | undefined): string {
  const speakerHint = known && known.length > 0
    ? `Known characters in the story: ${known.join(", ")}. Prefer these names for the speakers when context fits.`
    : `If the dialogue contains explicit names ("Bryan", "Mia") use those. Otherwise label speakers Cast 1, Cast 2, ...`;

  return [
    "You are a dialogue parser for a video story tool.",
    "You receive a block of dialogue text — one or more characters speaking — and split it into lines.",
    "",
    "Rules (HARD):",
    "1. When the text contains an explicit name tag (e.g. 'Bryan: ...', 'Mia said'), that EXACT NAME is the speaker. Never swap.",
    "2. When alternating Q/A with no name tag, FIRST line = Cast 1, SECOND = Cast 2, THIRD = Cast 1, etc. — strict alternation.",
    "3. NEVER assign a line to a speaker who didn't say it. NEVER swap who said what.",
    "4. Keep each speaker's line as one entry — do NOT split one statement across multiple lines.",
    "5. Preserve the exact wording. Do not paraphrase.",
    "6. Do NOT invent dialogue that isn't there.",
    "7. If unsure who said something, prefer Cast 1 / Cast 2 generic labels over guessing a known name wrong.",
    "",
    speakerHint,
    "",
    "Return JSON ONLY (no markdown, no commentary), exactly:",
    `{"lines": [{"speakerId": "Cast 1", "text": "..."}, {"speakerId": "Cast 2", "text": "..."}]}`,
    "If the text has no dialogue at all, return {\"lines\": []}.",
  ].join("\n");
}

/** Strip ```json fences and parse the largest JSON object found. */
function extractJSON(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  }
  return null;
}

async function tryProvider(
  prompt: string,
  system: string,
  provider: "ollama" | "openai" | "claude",
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  try {
    const r = await callLLM(prompt, system, {
      forceProvider: provider,
      role: provider === "claude" ? "fast" : "assistant",
      maxTokens: 2000,
    });
    if (!r.ok) return { ok: false, error: r.error || `${provider} failed` };
    if (!r.text?.trim()) return { ok: false, error: `${provider} returned empty` };
    return { ok: true, text: r.text, provider: r.provider || provider };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function POST(req: NextRequest) {
  let body: ParseRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  }

  const requestedProvider: Provider = body.provider || "auto";
  const chain: Array<"ollama" | "openai" | "claude"> =
    requestedProvider === "auto" ? ["ollama", "openai", "claude"] : [requestedProvider];

  const system = buildSystemPrompt(body.knownSpeakers);
  const prompt = `Dialogue text:\n"""\n${text.slice(0, 6000)}\n"""\n\nReturn JSON only.`;

  const errors: string[] = [];
  for (const p of chain) {
    const result = await tryProvider(prompt, system, p);
    if (!result.ok) {
      errors.push(`${p}: ${result.error}`);
      continue;
    }

    const parsed = extractJSON(result.text) as { lines?: ParsedLine[] } | null;
    if (!parsed || !Array.isArray(parsed.lines)) {
      errors.push(`${p}: invalid JSON shape`);
      continue;
    }

    // Sanitize results: ensure speakerId + text are non-empty strings.
    const cleaned: ParsedLine[] = parsed.lines
      .filter(l => typeof l?.text === "string" && l.text.trim())
      .map((l, i) => ({
        speakerId: (typeof l.speakerId === "string" && l.speakerId.trim()) || `Cast ${(i % 2) + 1}`,
        text: l.text.trim(),
        ...(typeof l.emotion === "string" ? { emotion: l.emotion } : {}),
      }));

    return NextResponse.json({
      ok: true,
      lines: cleaned,
      provider: result.provider,
      uniqueSpeakers: Array.from(new Set(cleaned.map(c => c.speakerId))),
    });
  }

  return NextResponse.json({
    ok: false,
    error: `All providers failed — ${errors.join(" | ")}`,
  }, { status: 502 });
}
