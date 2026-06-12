// Storyboard beat decomposition for Gen Max (Henry 2026-06-11).
//
// WHY THIS EXISTS: Gen Max used to build its N image prompts by regex-splitting the
// scene description into sentences (splitIntoActionBeats) and padding the remainder
// with camera-angle variations of the SAME full description. A one-sentence action
// ("The boy, chased by a dog, jumps over the fence and lands in mud") produced ONE
// natural beat + 7 angle-spam near-duplicates — no temporal progression, smiling
// posed shots, and the action itself was later stripped by toStaticFrame().
//
// This endpoint does what a human storyboard artist does: break ONE scene action
// into N chronological FROZEN INSTANTS of the same continuous motion, each frame
// restating every character's exact age + wardrobe (stops the 8yo → 42yo drift),
// the situation-true facial expression (chased = terrified, never smiling), and
// real prop scale relative to the character.
//
// Provider chain mirrors scene-edit: auto = ollama → openai → claude.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

type Provider = "auto" | "ollama" | "openai" | "claude";

interface CharacterIn {
  name: string;
  age?: string | null;          // "child" | "teen" | "young_adult" | "adult" | "elder" or freeform "8 years old"
  species?: string | null;
  wardrobe?: string | null;
  visualDescription?: string | null;
  skinTone?: string | null;     // e.g. "dark brown skin, African features, melanated" — restated per frame
}

interface DecomposeRequest {
  sceneText: string;            // title + description
  mood?: string;
  location?: string;
  timeOfDay?: string;
  frameCount: number;           // how many storyboard frames to produce (1-30)
  characters?: CharacterIn[];
  provider?: Provider;
}

export interface StoryboardFrame {
  moment: string;               // full visual description of ONE frozen instant (pose included)
  expression: string;           // what every visible face shows at this instant
  camera: string;               // shot type that best shows this instant
}

async function callWithFallback(
  prompt: string,
  system: string,
  provider: Provider,
  maxTokens: number
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  const chain: Array<"ollama" | "openai" | "claude"> =
    provider === "auto" ? ["ollama", "openai", "claude"] : [provider];
  const errors: string[] = [];
  for (const p of chain) {
    try {
      const r = await callLLM(prompt, system, {
        forceProvider: p,
        role: p === "claude" ? "fast" : "assistant",
        maxTokens,
      });
      if (r.ok && r.text?.trim()) {
        return { ok: true, text: r.text, provider: r.provider || p };
      }
      errors.push(`${p}: ${(!r.ok && r.error) || "empty reply"}`);
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: false, error: `All providers failed — ${errors.join(" | ")}` };
}

function extractJSON(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidates = [arrMatch?.[0], objMatch?.[0]].filter(Boolean) as string[];
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }
  return null;
}

// Human-readable age phrase the LLM must restate VERBATIM in every frame. The
// restatement is what stops diffusion age-drift across the frame sequence.
function agePhrase(age?: string | null): string {
  switch ((age || "").toLowerCase()) {
    case "child":       return "an 8-10 year old school-age child with child proportions";
    case "teen":        return "a 13-17 year old teenager";
    case "young_adult": return "a young adult in their early 20s";
    case "adult":       return "a 35-50 year old adult";
    case "elder":       return "an elder aged 65+ with grey hair";
    default:            return age ? String(age) : "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: DecomposeRequest = await req.json();
    if (!body.sceneText?.trim()) {
      return NextResponse.json({ ok: false, error: "sceneText is required" }, { status: 400 });
    }
    const provider: Provider = body.provider || "auto";
    const n = Math.max(1, Math.min(30, Math.floor(body.frameCount || 6)));

    const castBlock = (body.characters || [])
      .filter(c => c?.name)
      .map(c => {
        const bits = [
          `${c.name}: ${agePhrase(c.age)}`.replace(/:\s*$/, ""),
          c.species && c.species !== "human" ? `species: ${c.species}` : "",
          c.wardrobe ? `wearing ${String(c.wardrobe).slice(0, 100)}` : "",
          c.visualDescription ? String(c.visualDescription).slice(0, 160) : "",
        ].filter(Boolean);
        return `- ${bits.join(", ")}`;
      })
      .join("\n");

    const system = [
      "You are a film STORYBOARD ARTIST. Break ONE scene's action into a chronological sequence of FROZEN INSTANTS — like consecutive frames of a film strip.",
      "",
      "Think like a human watching the action in slow motion. Example: scene = \"The boy, chased by a dog, jumps over the fence and lands in a pool of mud\", 6 frames:",
      "  1. The boy sprints toward a chest-high wooden fence, the dog snapping at his heels, his body coiled to leap, face terrified.",
      "  2. The boy pushes off the ground, both feet leaving the dirt, hands reaching for the top rail, dog lunging behind him.",
      "  3. The boy is mid-air directly above the fence, legs tucked, clearing the top rail, dog skidding to a stop below.",
      "  4. The boy is descending on the far side of the fence, arms windmilling, the mud pool rushing up beneath him.",
      "  5. The instant of impact — the boy's feet and hands plunge into the mud, brown water exploding outward around him.",
      "  6. The boy sits in the mud pool, clothes soaked and filthy, panting with relief, the dog barking on the other side of the fence.",
      "",
      "STRICT RULES:",
      `1. Produce EXACTLY ${n} frames in chronological order: setup → initiation → peak → result → aftermath. If the action has fewer natural instants than frames requested, subdivide into finer micro-moments of the SAME action. NEVER invent unrelated events. NEVER repeat the same instant twice.`,
      "2. EVERY frame's \"moment\" must restate each visible character's EXACT age phrase and wardrobe from the CAST list, word for word. This is mandatory — image models forget age between frames.",
      "3. \"expression\" must match the SITUATION at that instant: chased = terrified; falling = panicked; struggling = straining. NEVER 'smiling' or 'happy' unless the scene is genuinely joyful at that instant.",
      "4. State the physical SCALE of key props relative to the character (e.g. 'a wooden fence as tall as the boy's chest', 'a mud pool two strides wide'). Keep that scale identical in every frame.",
      "5. CONTINUITY: same location, same lighting, same wardrobe, same props in every frame. Only the body positions and the action progress change.",
      "6. Each \"moment\" is a VISUAL image description in present tense — concrete body positions, no story prose, no camera jargon inside moment, no 'we see'.",
      "7. \"camera\" picks the shot that best shows that instant (e.g. 'wide tracking shot', 'low-angle action shot', 'medium shot from behind').",
      "",
      "Return a JSON ARRAY only, exactly this shape:",
      "[{\"moment\": str, \"expression\": str, \"camera\": str}, ...]",
      "No explanation. No markdown.",
    ].join("\n");

    const prompt = [
      `SCENE ACTION: ${body.sceneText.slice(0, 1200)}`,
      body.location ? `LOCATION: ${body.location}` : "",
      body.timeOfDay ? `TIME OF DAY: ${body.timeOfDay}` : "",
      body.mood ? `MOOD: ${body.mood}` : "",
      castBlock ? `CAST (restate ages + wardrobe verbatim in every frame):\n${castBlock}` : "",
      "",
      `Decompose into exactly ${n} chronological frames. JSON array only.`,
    ].filter(Boolean).join("\n");

    const result = await callWithFallback(prompt, system, provider, Math.min(4000, 400 + n * 220));
    if (!result.ok) {
      // Soft-fail with frames: [] — caller falls back to the legacy beat splitter.
      console.warn(`[beat-decompose] LLM failed: ${result.error}`);
      return NextResponse.json({ ok: false, frames: [], error: result.error });
    }

    const parsed = extractJSON(result.text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn(`[beat-decompose] parse failed — head: "${(result.text || "").slice(0, 120)}"`);
      return NextResponse.json({ ok: false, frames: [], error: "parse failed" });
    }

    const frames: StoryboardFrame[] = (parsed as Array<Record<string, unknown>>)
      .filter(f => f && typeof f.moment === "string" && (f.moment as string).trim().length > 10)
      .slice(0, n)
      .map(f => ({
        moment: (f.moment as string).trim(),
        expression: typeof f.expression === "string" ? f.expression.trim() : "",
        camera: typeof f.camera === "string" ? f.camera.trim() : "",
      }));

    if (frames.length === 0) {
      return NextResponse.json({ ok: false, frames: [], error: "no usable frames" });
    }

    // ── DETERMINISTIC AGE + WARDROBE RESTATEMENT (belt-and-braces) ──
    // Small local models (llama3:8b) often skip rule 2 and write "the boy" with no
    // age/wardrobe. Age-drift protection must NOT depend on LLM obedience — append
    // each visible character's age phrase + wardrobe to any frame missing them.
    const cast = (body.characters || []).filter(c => c?.name);
    for (const f of frames) {
      const additions: string[] = [];
      for (const c of cast) {
        // Solo casts always apply (frame may say "the boy" instead of the name);
        // multi-char casts apply only to characters actually named in the frame.
        const visible = cast.length === 1 || f.moment.toLowerCase().includes(c.name.toLowerCase());
        if (!visible) continue;
        const phrase = agePhrase(c.age);
        const bits: string[] = [];
        if (phrase && !f.moment.toLowerCase().includes(phrase.slice(0, 12).toLowerCase())) {
          bits.push(`${c.name} is ${phrase}`);
        }
        const wd = c.wardrobe ? String(c.wardrobe).slice(0, 100) : "";
        if (wd && !f.moment.toLowerCase().includes(wd.slice(0, 15).toLowerCase())) {
          bits.push(`wearing ${wd}`);
        }
        // Henry 2026-06-12: skin/ethnicity restated per frame too — without it the
        // multi-entity frames drifted ethnicity ("black boy → Indian/Asian boy").
        const st = c.skinTone ? String(c.skinTone).slice(0, 80) : "";
        if (st && !f.moment.toLowerCase().includes(st.slice(0, 15).toLowerCase())) {
          bits.push(`with ${st}`);
        }
        if (bits.length) additions.push(bits.join(", "));
      }
      if (additions.length) {
        const base = f.moment.replace(/\s+$/, "").replace(/([^.!?])$/, "$1.");
        f.moment = `${base} ${additions.join(". ")}.`;
      }
    }

    return NextResponse.json({ ok: true, frames, provider: result.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, frames: [], error: message }, { status: 500 });
  }
}
