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

type Op = "polish" | "break" | "expand" | "batch_polish" | "establish" | "establish_all";
type PolishMode = "default" | "add_action" | "intense" | "reduce_action" | "emotional" | "custom";
type Provider = "auto" | "ollama" | "openai" | "claude";

interface SceneIn {
  sceneId?: string;
  title?: string;
  description?: string;
  location?: string;
  timeOfDay?: string;
  mood?: string;
}

interface EstablishingShot {
  type: "opening" | "location" | "transition" | "mood" | "pre_action" | "exterior_building" | "aerial" | "beauty";
  prompt: string;
  durationSeconds: number;
  cameraMovement: string;
  mood: string;
  purpose: string;
  location: string;
  timeOfDay: string;
}

interface SceneEditRequest {
  op: Op;
  // For polish + break (single scene)
  scene?: SceneIn;
  // For establish — previous scene context for location/time/mood comparison
  prevScene?: SceneIn;
  // For expand / establish_all (all scenes + story context)
  scenes?: SceneIn[];
  storyText?: string;
  // For expand
  targetCount?: number;
  // Polish-only sub-mode
  polishMode?: PolishMode;
  // Free-text instruction for polishMode === "custom"
  customInstruction?: string;
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
    case "custom":
      return "Apply the user's custom instruction exactly as given.";
    case "default":
    default:
      return "Tighter, more dramatic, more visually concrete language.";
  }
}

async function runPolish(scene: SceneIn, mode: PolishMode, provider: Provider, customInstruction?: string) {
  const goal = mode === "custom" && customInstruction
    ? customInstruction
    : polishIntent(mode);
  const system = [
    "You rewrite a single scene description for a cinematic video story tool.",
    `Goal: ${goal}`,
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

// Apply one instruction to ALL scenes in a single LLM call — much faster than per-scene loop.
// Returns same-length array with updated descriptions. Falls back to original on parse failure.
async function runBatchPolish(scenes: SceneIn[], instruction: string, provider: Provider): Promise<Array<{ sceneId: string; title: string; description: string }>> {
  const system = [
    "You are editing a list of scene descriptions for a cinematic video story tool.",
    `Apply this instruction to EVERY scene: ${instruction}`,
    "Rules: Keep the same characters, locations, and story arc. Only change the prose to fulfil the instruction.",
    "Return a JSON array — one object per scene, same order, same count:",
    '[{ "sceneId": str, "title": str, "description": str }, ...]',
    "If an instruction does not apply to a scene, return that scene unchanged.",
    "Return JSON only. No explanation.",
  ].join("\n");

  const sceneBlock = scenes.map((s, i) =>
    `${i + 1}. sceneId="${s.sceneId || i}" title="${s.title || ""}" description="${(s.description || "").slice(0, 400)}"`
  ).join("\n");

  const prompt = `Scenes:\n${sceneBlock}\n\nApply the instruction to all scenes. JSON array only.`;

  const result = await callWithFallback(prompt, system, provider, Math.min(4000, 200 + scenes.length * 120));
  if (!result.ok) throw new Error(result.error);

  const parsed = extractJSON(result.text);
  if (!Array.isArray(parsed)) throw new Error("Batch parse failed");

  return scenes.map((orig, i) => {
    const updated = (parsed as Array<{ sceneId?: string; title?: string; description?: string }>)[i];
    return {
      sceneId: orig.sceneId || String(i),
      title: updated?.title || orig.title || "",
      description: updated?.description || orig.description || "",
    };
  });
}

// Analyze ONE scene — decide if it needs a cinematic establishing shot before it begins.
// Uses previous scene context to detect location/time/mood changes.
async function runEstablish(
  scene: SceneIn,
  prevScene: SceneIn | null,
  provider: Provider
): Promise<{ needed: boolean; shot: EstablishingShot | null }> {
  const system = [
    "You are a cinematic scene supervisor for a storytelling video tool.",
    "Decide if this scene needs a CINEMATIC ESTABLISHING SHOT before its main action begins.",
    "An establishing shot is a wide/aerial/exterior view showing location, scale, time of day, and mood BEFORE the main action starts.",
    "",
    "ADD an establishing shot when any of these apply:",
    "1. This is the first scene (story beginning)",
    "2. Location changed from the previous scene",
    "3. Time of day changed from the previous scene",
    "4. Mood shifted strongly (calm→tense, joy→grief, peace→danger)",
    "5. War, fight, chase, danger, romance, tragedy, celebration, or major event is about to begin",
    "6. Character enters an important place (palace, school, hospital, stadium, market, battlefield, city)",
    "7. The scene needs visual context the viewer does not have yet",
    "",
    "DO NOT ADD when:",
    "1. Scene continues in the same room/location as previous",
    "2. Fast action is already mid-flow",
    "3. Viewer already understands the location (used recently with no change)",
    "4. It would add unnecessary length",
    "",
    "Shot type options: opening | location | transition | mood | pre_action | exterior_building | aerial | beauty",
    "Camera movement options: slow push forward | slow pan left | slow pan right | gentle tilt up | gentle tilt down | static wide | slow crane up | drift right",
    "",
    "Prompt format: \"Cinematic [type] establishing shot of [location], during [time], with [mood], showing [visual details], camera [movement], designed to introduce [purpose].\"",
    "",
    "Return JSON only.",
    "If needed: {\"needed\":true,\"type\":\"...\",\"prompt\":\"...\",\"durationSeconds\":5,\"cameraMovement\":\"...\",\"mood\":\"...\",\"purpose\":\"...\",\"location\":\"...\",\"timeOfDay\":\"...\"}",
    "If not needed: {\"needed\":false}",
  ].join("\n");

  const prevBlock = prevScene
    ? `Previous Scene: "${prevScene.title || "unknown"}" — Location: ${prevScene.location || "unknown"} | Time: ${prevScene.timeOfDay || "unknown"} | Mood: ${prevScene.mood || "unknown"}`
    : "Previous Scene: NONE — this is the very first scene.";

  const prompt = [
    prevBlock,
    "",
    `Current Scene: "${scene.title || ""}"`,
    `Description: ${scene.description || ""}`,
    `Location: ${scene.location || "unknown"}`,
    `Time of Day: ${scene.timeOfDay || "unknown"}`,
    `Mood: ${scene.mood || "unknown"}`,
    "",
    "Does this scene need a cinematic establishing shot? Return JSON only.",
  ].join("\n");

  const result = await callWithFallback(prompt, system, provider, 400);
  if (!result.ok) throw new Error(result.error);
  const parsed = extractJSON(result.text) as Record<string, unknown> | null;
  if (!parsed || parsed.needed === false) return { needed: false, shot: null };
  if (!parsed.type || !parsed.prompt) return { needed: false, shot: null };
  return {
    needed: true,
    shot: {
      type: parsed.type as EstablishingShot["type"],
      prompt: parsed.prompt as string,
      durationSeconds: (parsed.durationSeconds as number) || 5,
      cameraMovement: (parsed.cameraMovement as string) || "slow push forward",
      mood: (parsed.mood as string) || "",
      purpose: (parsed.purpose as string) || "",
      location: (parsed.location as string) || scene.location || "",
      timeOfDay: (parsed.timeOfDay as string) || scene.timeOfDay || "",
    },
  };
}

// Analyze ALL scenes in order — decide which ones need establishing shots.
// Returns one result per scene (needed true/false + shot data).
async function runEstablishAll(
  scenes: SceneIn[],
  storyText: string,
  provider: Provider
): Promise<Array<{ sceneId: string; needed: boolean; shot: EstablishingShot | null }>> {
  const system = [
    "You are a cinematic scene supervisor for a storytelling video tool.",
    "Analyze ALL scenes in order. For each, decide if it needs a CINEMATIC ESTABLISHING SHOT before its main action.",
    "An establishing shot is a wide/aerial/exterior view showing location, scale, time of day, and mood BEFORE main action.",
    "",
    "ADD when: story begins (always first scene), location changes, time changes, strong mood shift, war/fight/chase/romance/tragedy coming, entering important place, new geography needed.",
    "DO NOT ADD when: same room as previous scene, fast action already mid-flow, location already known from recent scene, adds unnecessary length.",
    "Never repeat the same establishing shot type for the same unchanged location twice in a row.",
    "",
    "Return a JSON array — one object per scene in the same order as given:",
    "[{\"sceneId\":\"...\",\"needed\":true,\"type\":\"opening|location|transition|mood|pre_action|exterior_building|aerial|beauty\",\"prompt\":\"Cinematic [type] establishing shot of [location], during [time], with [mood], showing [details], camera [movement], designed to introduce [purpose].\",\"durationSeconds\":5,\"cameraMovement\":\"slow push forward\",\"mood\":\"...\",\"purpose\":\"...\",\"location\":\"...\",\"timeOfDay\":\"...\"}]",
    "For scenes that do not need one: {\"sceneId\":\"...\",\"needed\":false}",
    "Return JSON array only. No explanation.",
  ].join("\n");

  const sceneBlock = scenes.map((s, i) =>
    `${i + 1}. sceneId="${s.sceneId || i}" title="${s.title || ""}" location="${s.location || "unknown"}" time="${s.timeOfDay || "unknown"}" mood="${s.mood || "unknown"}" desc="${(s.description || "").slice(0, 200)}"`
  ).join("\n");

  const prompt = [
    storyText ? `Story:\n${storyText.slice(0, 2000)}\n` : "",
    `Scenes (${scenes.length}):`,
    sceneBlock,
    "",
    "Analyze all. Return JSON array only.",
  ].filter(Boolean).join("\n");

  const result = await callWithFallback(prompt, system, provider, Math.min(3000, 300 + scenes.length * 150));
  if (!result.ok) throw new Error(result.error);
  const parsed = extractJSON(result.text);
  if (!Array.isArray(parsed)) throw new Error("Establish all parse failed");

  return scenes.map((orig, i) => {
    const r = (parsed as Array<Record<string, unknown>>)[i];
    if (!r || !r.needed || !r.type || !r.prompt) {
      return { sceneId: orig.sceneId || String(i), needed: false, shot: null };
    }
    return {
      sceneId: orig.sceneId || String(i),
      needed: true,
      shot: {
        type: r.type as EstablishingShot["type"],
        prompt: r.prompt as string,
        durationSeconds: (r.durationSeconds as number) || 5,
        cameraMovement: (r.cameraMovement as string) || "slow push forward",
        mood: (r.mood as string) || "",
        purpose: (r.purpose as string) || "",
        location: (r.location as string) || orig.location || "",
        timeOfDay: (r.timeOfDay as string) || orig.timeOfDay || "",
      },
    };
  });
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
      const polished = await runPolish(body.scene, mode, provider, body.customInstruction);
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

    if (body.op === "batch_polish") {
      if (!body.scenes || body.scenes.length === 0) {
        return NextResponse.json({ ok: false, error: "Missing scenes" }, { status: 400 });
      }
      if (!body.customInstruction?.trim()) {
        return NextResponse.json({ ok: false, error: "Missing customInstruction" }, { status: 400 });
      }
      const updated = await runBatchPolish(body.scenes, body.customInstruction, provider);
      return NextResponse.json({ ok: true, scenes: updated, provider });
    }

    if (body.op === "establish") {
      if (!body.scene) return NextResponse.json({ ok: false, error: "Missing scene" }, { status: 400 });
      const result = await runEstablish(body.scene, body.prevScene || null, provider);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.op === "establish_all") {
      if (!body.scenes || body.scenes.length === 0) {
        return NextResponse.json({ ok: false, error: "Missing scenes" }, { status: 400 });
      }
      const results = await runEstablishAll(body.scenes, body.storyText || "", provider);
      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.json({ ok: false, error: `Unknown op ${body.op}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
