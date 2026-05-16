import { NextRequest, NextResponse } from "next/server";

// ── Change scope classifier (pure logic) ──────────────────────────────────────

type Scope = "low" | "medium" | "high";

const SCOPE_RULES: Array<{ target: string; actions: string[]; scope: Scope }> = [
  { target: "SUBTITLE",   actions: ["CHANGE", "REPLACE"],           scope: "low" },
  { target: "VOLUME",     actions: ["CHANGE"],                      scope: "low" },
  { target: "LOGO",       actions: ["MOVE", "REPLACE"],             scope: "low" },
  { target: "SFX",        actions: ["REMOVE", "REPLACE", "MUTE"],   scope: "medium" },
  { target: "MUSIC",      actions: ["CHANGE", "REPLACE", "MUTE"],   scope: "medium" },
  { target: "DIALOGUE",   actions: ["CHANGE", "REPLACE"],           scope: "medium" },
  { target: "SCENE",      actions: ["REORDER"],                     scope: "medium" },
  { target: "SHOT",       actions: ["REORDER", "TRIM"],             scope: "medium" },
  { target: "CAMERA",     actions: ["CHANGE"],                      scope: "medium" },
  { target: "CHARACTER",  actions: ["CHANGE"],                      scope: "high" },
  { target: "SHOT",       actions: ["REGENERATE"],                  scope: "high" },
  { target: "SCENE",      actions: ["REGENERATE", "REPLACE"],       scope: "high" },
];

function classifyScope(targetType: string, action: string): Scope {
  for (const rule of SCOPE_RULES) {
    if (rule.target === targetType.toUpperCase() && rule.actions.includes(action.toUpperCase())) {
      return rule.scope;
    }
  }
  return "medium";
}

function estimateCost(scope: Scope, requiresRegeneration: boolean): number {
  if (!requiresRegeneration) return 0;
  if (scope === "low") return 0;
  if (scope === "medium") return 5;
  return 25;
}

// ── Intent parser via Claude Haiku ───────────────────────────────────────────

interface IntentResult {
  action: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
  scope: Scope;
  requiresRegeneration: boolean;
  estimatedCost: number;
  clarification_needed?: boolean;
  specific_question?: string;
}

async function parseIntentWithHaiku(
  instruction: string,
  contextObjectId: string,
  projectState: { scenes: Array<{ scene_id: string; scene_number: number; shots?: Array<{ shot_id: string }> }>; characters: Array<{ character_id: string; name: string }> }
): Promise<IntentResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const sceneList = projectState.scenes.slice(0, 10).map(s =>
    `${s.scene_id}(${s.shots?.map(sh => sh.shot_id).join(",") ?? "no shots"})`
  ).join(", ");

  const charList = projectState.characters.slice(0, 8).map(c =>
    `${c.character_id}=${c.name}`
  ).join(", ");

  const systemPrompt = `You are a Semi-AI Collaboration Intent Parser for GHS (GioHomeStudio).

Parse the user's instruction and return ONLY a JSON object with these fields:
- action: one of REMOVE | REPLACE | CHANGE | REORDER | REGENERATE | MUTE | TRIM | EXTEND
- target_type: one of SFX | DIALOGUE | CHARACTER | SCENE | SHOT | MUSIC | CAMERA | SUBTITLE | VOLUME
- target_id: the specific ID from context (e.g. SH04-01, scene_004, CH01) or "current" if no ID mentioned
- payload: object with relevant data (e.g. { "value": "rain" } for remove rain)
- requiresRegeneration: boolean — true only if this needs AI image/video re-generation
- clarification_needed: boolean — true if instruction is genuinely ambiguous
- specific_question: string (only if clarification_needed is true) — one short question to resolve ambiguity

Context:
- Current object: ${contextObjectId}
- Available scenes: ${sceneList}
- Characters: ${charList}

Rules:
- Never guess a target_id that doesn't exist in context — use "current" if unsure
- SFX remove/mute = requiresRegeneration false
- Dialogue change = requiresRegeneration false
- Music change = requiresRegeneration false
- Shot regenerate = requiresRegeneration true
- Character visual change = requiresRegeneration true
- If instruction mentions a specific sound effect, extract it into payload.value
- Return ONLY valid JSON, no markdown, no commentary`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: instruction }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const raw = content.text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(raw) as Omit<IntentResult, "scope" | "estimatedCost">;

  const scope = classifyScope(parsed.target_type, parsed.action);
  const requiresRegeneration = parsed.requiresRegeneration ?? false;

  return {
    ...parsed,
    scope,
    requiresRegeneration,
    estimatedCost: estimateCost(scope, requiresRegeneration),
  };
}

// ── Fallback: rule-based parser (no API key) ──────────────────────────────────

function parseIntentSimple(instruction: string, contextObjectId: string): IntentResult {
  const lower = instruction.toLowerCase();

  let action = "CHANGE";
  let targetType = "DIALOGUE";
  let payload: Record<string, unknown> = {};

  if (lower.includes("remove") || lower.includes("delete")) action = "REMOVE";
  else if (lower.includes("replace") || lower.includes("swap")) action = "REPLACE";
  else if (lower.includes("mute")) action = "MUTE";
  else if (lower.includes("reorder") || lower.includes("move")) action = "REORDER";
  else if (lower.includes("regenerate") || lower.includes("redo")) action = "REGENERATE";
  else if (lower.includes("trim") || lower.includes("cut")) action = "TRIM";

  if (lower.includes("sfx") || lower.includes("sound effect") || lower.includes("rain") || lower.includes("wind") || lower.includes("crowd")) {
    targetType = "SFX";
    const match = lower.match(/\b(rain|wind|crowd|thunder|bell|birds|traffic|music|ambient)\b/);
    if (match) payload = { value: match[1] };
  } else if (lower.includes("dialogue") || lower.includes("line") || lower.includes("says") || lower.includes("speaking")) {
    targetType = "DIALOGUE";
  } else if (lower.includes("music") || lower.includes("track") || lower.includes("song")) {
    targetType = "MUSIC";
  } else if (lower.includes("camera") || lower.includes("angle") || lower.includes("shot type")) {
    targetType = "CAMERA";
  } else if (lower.includes("character") || lower.includes("actor") || lower.includes("appearance")) {
    targetType = "CHARACTER";
    action = action === "CHANGE" ? "CHANGE" : action;
  } else if (lower.includes("scene") && (lower.includes("reorder") || lower.includes("move"))) {
    targetType = "SCENE";
    action = "REORDER";
  } else if (lower.includes("subtitle") || lower.includes("caption")) {
    targetType = "SUBTITLE";
  }

  const scope = classifyScope(targetType, action);
  const requiresRegeneration = scope === "high" || action === "REGENERATE";

  return {
    action,
    target_type: targetType,
    target_id: contextObjectId || "current",
    payload,
    scope,
    requiresRegeneration,
    estimatedCost: estimateCost(scope, requiresRegeneration),
    clarification_needed: false,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instruction, contextObjectId, projectState } = body as {
      instruction: string;
      contextObjectId?: string;
      projectState?: { scenes: Array<{ scene_id: string; scene_number: number; shots?: Array<{ shot_id: string }> }>; characters: Array<{ character_id: string; name: string }> };
    };

    if (!instruction || typeof instruction !== "string" || instruction.trim().length < 3) {
      return NextResponse.json({ error: "instruction is required (min 3 chars)" }, { status: 400 });
    }

    const ctxId = contextObjectId ?? "current";
    const state = projectState ?? { scenes: [], characters: [] };

    let result: IntentResult;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        result = await parseIntentWithHaiku(instruction.trim(), ctxId, state);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[collabo-edit] Haiku parse failed, using rule-based fallback:", msg);
        result = parseIntentSimple(instruction.trim(), ctxId);
      }
    } else {
      result = parseIntentSimple(instruction.trim(), ctxId);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/story/tools/collabo-edit]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
