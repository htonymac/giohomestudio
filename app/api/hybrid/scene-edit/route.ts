// Scene editing operations.
//
// Operations (`op`):
//   - polish  : rewrite ONE scene's prose. Sub-modes via `polishMode`:
//       "default"      → tighter, more dramatic
//       "add_action"   → add more action verbs / movement beats
//       "intense"      → escalate stakes, sharpen tension
//       "reduce_action"→ soften, slow down, more reflective
//       "emotional"    → emphasize feelings, internal state
//   - break   : split ONE scene into 2 consecutive scenes
//   - expand  : take ALL scenes + story → return longer ordered list
//
// Provider (`provider`): "auto" | "ollama" | "openai" | "claude"
//   "auto" runs the chain ollama → openai → claude (haiku) and returns the first success.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

type Op = "polish" | "break" | "expand";
type PolishMode = "default" | "add_action" | "intense" | "reduce_action" | "emotional";
type Provider = "auto" | "ollama" | "openai" | "claude";

interface SceneIn {
  sceneId?: string;
  title?: string;
  description?: string;
  location?: string;
  timeOfDay?: string;
  mood?: string;
}

interface SceneEditRequest {
  op: Op;
  // For polish + break (single scene)
  scene?: SceneIn;
  // For expand (all scenes + story context)
  scenes?: SceneIn[];
  storyText?: string;
  // For expand
  targetCount?: number;
  // Polish-only sub-mode
  polishMode?: PolishMode;
  // Provider chain control (defaults to "auto")
  provider?: Provider;
}

/**
 * Try a provider chain in order. Returns the first successful result.
 * Mirrors the helper in scene-chat — same fallback semantics across both AI features.
 */
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

interface SceneOut {
  title: string;
  description: string;
  location?: string;
  timeOfDay?: string;
  mood?: string;
}

function extractJSON(text: string): unknown | null {
  // Strip code fences and find first {…} or […]
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidates = [arrMatch?.[0], objMatch?.[0]].filter(Boolean) as string[];
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }
  return null;
}

/**
 * Per-mode polish instructions. The intent line is what changes per button —
 * the JSON return shape is identical across modes so the client's parsing path
 * is uniform.
 */
function polishIntent(mode: PolishMode): string {
  switch (mode) {
    case "add_action":
      return "Add MORE action verbs and physical movement beats. Make characters DO things — running, lunging, grabbing, turning, ducking. Replace static description with kinetic motion.";
    case "intense":
      return "MAKE IT MORE INTENSE. Raise the stakes. Sharpen the tension. Tighten sentences. Use stronger verbs, harsher consequences, urgent stakes.";
    case "reduce_action":
      return "REDUCE the action. Slow it down. Replace some action verbs with reflection, observation, internal thought. Make the scene quieter and more contemplative.";
    case "emotional":
      return "MAKE IT MORE EMOTIONAL. Emphasize what the characters FEEL. Surface the internal weight of the moment — fear, grief, longing, joy. Bring the emotion to the surface.";
    case "default":
    default:
      return "Tighter, more dramatic, more visually concrete language.";
  }
}

async function runPolish(scene: SceneIn, mode: PolishMode, provider: Provider) {
  const system = [
    "You rewrite a single scene description for a cinematic video story tool.",
    `Goal: ${polishIntent(mode)}`,
    "Keep the SAME story beat, characters, location, and mood — only change the prose to match the goal.",
    "Do not invent new characters, do not change the outcome.",
    "Return JSON only: { \"title\": string, \"description\": string }",
  ].join("\n");

  const prompt = [
    `Title: ${scene.title || ""}`,
    `Description: ${scene.description || ""}`,
    scene.location ? `Location: ${scene.location}` : "",
    scene.mood ? `Mood: ${scene.mood}` : "",
    "",
    "Rewrite per the goal above. JSON only.",
  ].filter(Boolean).join("\n");

  const result = await callWithFallback(prompt, system, provider, 600);
  if (!result.ok) throw new Error(result.error);
  const parsed = extractJSON(result.text) as { title?: string; description?: string } | null;
  if (!parsed) throw new Error("Polish parse failed");
  return {
    title: parsed.title || scene.title || "",
    description: parsed.description || scene.description || "",
    provider: result.provider,
  };
}

async function runBreak(scene: SceneIn, provider: Provider): Promise<SceneOut[]> {
  const system = [
    "You split ONE scene into TWO consecutive scenes for a cinematic video story tool.",
    "Find a natural mid-point — a moment, a beat change, a turn — to break.",
    "Both halves must be coherent on their own. Same characters, same location unless the break clearly changes location.",
    "Return JSON ARRAY only: [{ \"title\": str, \"description\": str, \"location\": str, \"timeOfDay\": str, \"mood\": str }, {...}]",
    "Exactly 2 items.",
  ].join("\n");

  const prompt = [
    `Original Title: ${scene.title || ""}`,
    `Original Description: ${scene.description || ""}`,
    scene.location ? `Location: ${scene.location}` : "",
    scene.timeOfDay ? `Time: ${scene.timeOfDay}` : "",
    scene.mood ? `Mood: ${scene.mood}` : "",
    "",
    "Split into 2. JSON array only.",
  ].filter(Boolean).join("\n");

  const result = await callWithFallback(prompt, system, provider, 800);
  if (!result.ok) throw new Error(result.error);
  const parsed = extractJSON(result.text);
  if (!Array.isArray(parsed) || parsed.length < 2) throw new Error("Break parse failed");
  return (parsed as SceneOut[]).slice(0, 2).map((s, i) => ({
    title: s.title || `${scene.title || "Scene"} (${i + 1})`,
    description: s.description || "",
    location: s.location || scene.location,
    timeOfDay: s.timeOfDay || scene.timeOfDay,
    mood: s.mood || scene.mood,
  }));
}

async function runExpand(scenes: SceneIn[], storyText: string, targetCount: number | undefined, provider: Provider): Promise<SceneOut[]> {
  const startCount = scenes.length;
  const target = targetCount && targetCount > startCount
    ? targetCount
    : Math.min(Math.max(startCount + 3, Math.ceil(startCount * 1.6)), 24);

  const system = [
    "You expand a scene list for a cinematic video story tool.",
    "Goal: add scenes that fill in gaps between existing beats — transitions, reactions, reveals, escalations.",
    "STRICT RULES:",
    "- Preserve the same story arc, same characters, same ending.",
    "- DO NOT change the genre, twist, or outcome.",
    "- New scenes must fit BETWEEN or alongside the existing ones, not replace them.",
    "- Keep titles short (max 8 words).",
    `- Target total scene count: ${target}.`,
    "Return JSON ARRAY only of the FULL expanded scene list (existing + new in order):",
    "[{ \"title\": str, \"description\": str, \"location\": str, \"timeOfDay\": str, \"mood\": str }, ...]",
  ].join("\n");

  const sceneBlock = scenes.map((s, i) => `${i + 1}. ${s.title || ""} — ${s.description || ""}`).join("\n");
  const prompt = [
    storyText ? `Story Context:\n${storyText.slice(0, 4000)}\n` : "",
    `Existing Scenes (${startCount}):`,
    sceneBlock,
    "",
    `Expand to ${target} scenes. JSON array only.`,
  ].filter(Boolean).join("\n");

  const result = await callWithFallback(prompt, system, provider, 3000);
  if (!result.ok) throw new Error(result.error);
  const parsed = extractJSON(result.text);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Expand parse failed");
  return (parsed as SceneOut[]).map((s, i) => ({
    title: s.title || `Scene ${i + 1}`,
    description: s.description || "",
    location: s.location,
    timeOfDay: s.timeOfDay,
    mood: s.mood,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body: SceneEditRequest = await req.json();
    if (!body.op) {
      return NextResponse.json({ ok: false, error: "Missing op" }, { status: 400 });
    }

    const provider: Provider = body.provider || "auto";

    if (body.op === "polish") {
      if (!body.scene) return NextResponse.json({ ok: false, error: "Missing scene" }, { status: 400 });
      const mode: PolishMode = body.polishMode || "default";
      const polished = await runPolish(body.scene, mode, provider);
      return NextResponse.json({ ok: true, scene: polished, provider: polished.provider });
    }

    if (body.op === "break") {
      if (!body.scene) return NextResponse.json({ ok: false, error: "Missing scene" }, { status: 400 });
      const halves = await runBreak(body.scene, provider);
      return NextResponse.json({ ok: true, scenes: halves });
    }

    if (body.op === "expand") {
      if (!body.scenes || body.scenes.length === 0) {
        return NextResponse.json({ ok: false, error: "Missing scenes" }, { status: 400 });
      }
      const expanded = await runExpand(body.scenes, body.storyText || "", body.targetCount, provider);
      return NextResponse.json({ ok: true, scenes: expanded });
    }

    return NextResponse.json({ ok: false, error: `Unknown op ${body.op}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
