// POST /api/hybrid/character-parse
//
// Takes a free-form character description and returns the 9 structured Visual Identity fields.
// User describes the character in plain English → Ollama → JSON with fields → UI populates.
// Same provider chain pattern as scene-chat: ollama → openai → claude (Haiku) fallback.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

type Provider = "auto" | "ollama" | "openai" | "claude";

interface CharacterParseRequest {
  text: string;
  /** Optional: existing fields to use as defaults — AI only overrides what user mentioned */
  existing?: Partial<CharacterFields>;
  provider?: Provider;
}

// Field names must match the hybrid-planner CharacterIdentity interface exactly.
// 2026-05-10 — Wave I's first attempt failed by guessing `ageYears` + `postureEnergy`
// (those fields DO NOT exist). Real names are `ageRange` + `ageAppearance`.
interface CharacterFields {
  species: string;             // "human" | "dog" | "rabbit" | etc.
  bodyBuild: string;           // "slim and tall", "stocky", etc.
  colorDescription: string;    // "lightly tanned skin"
  faceFeatures: string;        // "straight nose, defined jawline, dark hair"
  clothingDetails: string;     // "dark blue blazer, white t-shirt..."
  accessories: string;         // "black belt"
  ageRange: string;            // "child" | "teen" | "young_adult" | "adult" | "elder"
  ageAppearance: string;       // free-form: "appears to be in late 20s, standing upright"
  distinctiveFeatures: string; // "well-groomed dark hair, neutral expression"
}

const FIELD_KEYS: Array<keyof CharacterFields> = [
  "species", "bodyBuild", "colorDescription", "faceFeatures",
  "clothingDetails", "accessories", "ageRange", "ageAppearance", "distinctiveFeatures",
];

function buildSystemPrompt(existing: Partial<CharacterFields> | undefined): string {
  const existingNote = existing && Object.keys(existing).length > 0
    ? `\nExisting field values (KEEP these unless user clearly changes them):\n${JSON.stringify(existing, null, 2)}\n`
    : "";
  return [
    "You are a character design parser for a video story tool.",
    "User describes a character in plain English. You extract structured visual identity fields.",
    "",
    "Output JSON ONLY (no markdown, no commentary) with EXACTLY these 9 keys:",
    "  species          — one word: human, dog, rabbit, cat, lion, fox, robot, etc.",
    "  bodyBuild        — body shape: slim, stocky, tall, short, muscular, etc.",
    "  colorDescription — skin/fur color: lightly tanned skin, jet black fur, etc.",
    "  faceFeatures     — face shape, nose, eyes, hair, facial hair (one comma-list)",
    "  clothingDetails  — every garment: dark blue blazer, white t-shirt, jeans, sneakers",
    "  accessories      — bags, jewelry, glasses, watches, props — or empty string",
    "  ageRange         — one of: \"child\", \"teen\", \"young_adult\", \"adult\", \"elder\"",
    "  ageAppearance    — free-form: \"appears to be in late 20s, standing upright with confident posture\"",
    "  distinctiveFeatures — what MUST appear every render: scar, freckles, unique hair, signature item",
    "",
    "Rules:",
    "1. Every key must be present. Use empty string \"\" if the user didn't specify AND no existing value.",
    "2. Don't invent details the user didn't mention — keep extracted fields tight and accurate.",
    "3. ageRange must be one of the 5 allowed enum values.",
    "4. species lowercase single word.",
    "5. If user only describes partial fields, the rest stay empty (or existing if provided).",
    existingNote,
  ].join("\n");
}

function extractJSON(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return null;
}

async function runWithFallback(
  prompt: string,
  system: string,
  provider: Provider,
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  const chain: Array<"ollama" | "openai" | "claude"> =
    provider === "auto" ? ["ollama", "openai", "claude"] : [provider];
  const errors: string[] = [];
  for (const p of chain) {
    try {
      const r = await callLLM(prompt, system, {
        forceProvider: p,
        role: p === "claude" ? "fast" : "assistant",
        maxTokens: 800,
      });
      if (r.ok && r.text?.trim()) {
        return { ok: true, text: r.text, provider: r.provider || p };
      }
      errors.push(`${p}: ${(!r.ok && r.error) || "empty"}`);
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: false, error: `All providers failed — ${errors.join(" | ")}` };
}

/**
 * Normalize the AI's response into a clean CharacterFields object.
 * Ensures every key exists and is a string. Falls back to existing or "" per key.
 */
function normalizeFields(raw: unknown, existing: Partial<CharacterFields> = {}): CharacterFields {
  const r = (raw as Partial<Record<string, unknown>>) || {};
  const out = {} as CharacterFields;
  for (const k of FIELD_KEYS) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) {
      out[k] = v.trim();
    } else if (existing[k]) {
      out[k] = existing[k] as string;
    } else {
      out[k] = "";
    }
  }
  // ageRange must be one of the allowed enum values — normalize loose values into the closest match.
  const allowed = ["child", "teen", "young_adult", "adult", "elder"];
  if (out.ageRange && !allowed.includes(out.ageRange.toLowerCase())) {
    const v = out.ageRange.toLowerCase();
    if (/(\b|^)([0-9]|10|11|12)\b|child|kid|toddler|infant/.test(v)) out.ageRange = "child";
    else if (/teen|13|14|15|16|17|18|19/.test(v)) out.ageRange = "teen";
    else if (/young.?adult|2[0-9]|early.30/.test(v)) out.ageRange = "young_adult";
    else if (/elder|senior|old|6[0-9]|7[0-9]|8[0-9]/.test(v)) out.ageRange = "elder";
    else out.ageRange = "adult";
  } else if (out.ageRange) {
    out.ageRange = out.ageRange.toLowerCase();
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: CharacterParseRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  }

  const system = buildSystemPrompt(body.existing);
  const prompt = `Describe the character extraction. User input:\n"""\n${text.slice(0, 2000)}\n"""\n\nReturn JSON only.`;

  const result = await runWithFallback(prompt, system, body.provider || "auto");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const parsed = extractJSON(result.text);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({
      ok: false,
      error: "AI returned invalid JSON",
      raw: result.text.slice(0, 400),
    }, { status: 502 });
  }

  const fields = normalizeFields(parsed, body.existing);
  return NextResponse.json({
    ok: true,
    fields,
    provider: result.provider,
  });
}
