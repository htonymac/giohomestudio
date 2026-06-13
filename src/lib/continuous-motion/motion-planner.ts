// GioHomeStudio — Continuous Motion Planner (Session 3)
// Splits a long scene prompt by physical motion, not punctuation.
// Henry 2026-06-13: was Claude-direct only — with the Anthropic key at $0 every
// run fell back to the dumb splitter. Now uses the house callLLM cascade
// (ollama → openai → claude) like scene-edit, so a free local model handles
// splitting when paid keys are dry.
//
// Functions:
//   planMotionUnits(prompt, totalDuration, segmentMaxDuration) — LLM splits prompt by action
//   planSegmentDurations(units, providerMaxDuration) — maps units to per-segment durations

import { callLLM } from "@/lib/llm";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MotionUnit {
  unit: number;           // 1-indexed
  action: string;         // physical action description
  duration: number;       // planned duration in seconds for this unit
}

export interface SegmentPlan {
  segmentIndex: number;   // 0-indexed
  unitIndex: number;      // which MotionUnit this segment covers (0-indexed)
  action: string;
  duration: number;       // actual generation duration for this segment (≤ providerMaxDuration)
  startTime: number;      // seconds from scene start
  endTime: number;        // seconds from scene start
}

export interface MotionPlan {
  units: MotionUnit[];
  segments: SegmentPlan[];
  totalDuration: number;
  segmentCount: number;
}

// ── Claude model ──────────────────────────────────────────────────────────

// (model choice now lives in the callLLM cascade — see planMotionUnits)

// ── Fallback splitter (no API key) ────────────────────────────────────────

/**
 * Simple fallback: split on sentence boundaries + clause-level commas.
 * Used when Anthropic API key is not available.
 */
function fallbackSplitByMotion(prompt: string, totalDuration: number, segmentMaxDuration: number): MotionUnit[] {
  // Split by "and", clause boundaries, or action verbs
  const raw = prompt
    .replace(/,\s+(?:and\s+)?/g, "\n")
    .replace(/\.\s+/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 3);

  if (raw.length === 0) raw.push(prompt.trim());

  // Distribute duration evenly
  const durationPerUnit = totalDuration / raw.length;
  return raw.map((action, i) => ({
    unit: i + 1,
    action,
    duration: Math.round(Math.min(durationPerUnit, segmentMaxDuration) * 100) / 100,
  }));
}

// ── planMotionUnits ────────────────────────────────────────────────────────

/**
 * Split a long scene prompt into physical motion units using Claude Haiku.
 * NOT by sentence — by actual physical action changes.
 *
 * Example input: "He ran to the cliff edge, jumped, fell through air, hit water"
 * Example output:
 *   { unit: 1, action: "running toward cliff edge", duration: 5 }
 *   { unit: 2, action: "jumping off cliff", duration: 5 }
 *   ...
 *
 * @param prompt              Full scene prompt
 * @param totalDuration       Total scene duration in seconds
 * @param segmentMaxDuration  Provider's max comfortable segment duration
 */
export async function planMotionUnits(
  prompt: string,
  totalDuration: number,
  segmentMaxDuration: number
): Promise<MotionUnit[]> {
  const segmentCount = Math.ceil(totalDuration / segmentMaxDuration);

  const system = `You split a video scene prompt into physical motion units for AI video generation.
Each unit should describe ONE distinct physical action or camera state change.
Split by PHYSICAL ACTION, not by punctuation or sentence length.
Target exactly ${segmentCount} units for a ${totalDuration}-second scene.

Return ONLY strict JSON array:
[
  { "unit": 1, "action": "clear physical action description", "duration": 5 },
  { "unit": 2, "action": "next distinct action", "duration": 5 }
]

Rules:
- Each action should be 3-15 words
- Duration per unit: max ${segmentMaxDuration}s, last unit may be shorter
- All durations must sum to exactly ${totalDuration}s
- No markdown, no code fences. JSON array only.`;
  const userPrompt = `Scene prompt: "${prompt}"\nTotal duration: ${totalDuration}s\nTarget segments: ${segmentCount}`;

  try {
    // Provider cascade — first success wins; ALL fail → deterministic fallback splitter.
    let text = "";
    const errors: string[] = [];
    for (const p of ["ollama", "openai", "claude"] as const) {
      try {
        const r = await callLLM(userPrompt, system, { forceProvider: p, role: p === "claude" ? "fast" : "assistant", maxTokens: 800 });
        if (r.ok && r.text?.trim()) { text = r.text.trim(); console.log(`[motion-planner] split via ${p}`); break; }
        errors.push(`${p}: ${(!r.ok && r.error) || "empty"}`);
      } catch (e) {
        errors.push(`${p}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!text) {
      console.warn(`[motion-planner] all LLM providers failed (${errors.join(" | ")}) — using fallback splitter`);
      return fallbackSplitByMotion(prompt, totalDuration, segmentMaxDuration);
    }

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return fallbackSplitByMotion(prompt, totalDuration, segmentMaxDuration);
    }

    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fallbackSplitByMotion(prompt, totalDuration, segmentMaxDuration);
    }

    return parsed.map((u: Partial<MotionUnit>, i: number) => ({
      unit: typeof u.unit === "number" ? u.unit : i + 1,
      action: typeof u.action === "string" ? u.action : `action ${i + 1}`,
      duration: typeof u.duration === "number" ? u.duration : segmentMaxDuration,
    }));
  } catch (err) {
    console.error("[motion-planner] Claude split failed, using fallback:", err);
    return fallbackSplitByMotion(prompt, totalDuration, segmentMaxDuration);
  }
}

// ── planSegmentDurations ──────────────────────────────────────────────────

/**
 * Map motion units to per-segment generation durations.
 * Each segment duration must not exceed providerMaxDuration.
 * Total must sum to totalDuration (last segment may be shorter).
 *
 * Example: 27s total, max 5s → [5, 5, 5, 5, 5, 2]
 * Example: 27s total, max 10s → [10, 10, 7]
 *
 * @param units              Motion units from planMotionUnits
 * @param providerMaxDuration  Provider max segment duration in seconds
 */
export function planSegmentDurations(
  units: MotionUnit[],
  providerMaxDuration: number
): SegmentPlan[] {
  if (units.length === 0) return [];

  const plans: SegmentPlan[] = [];
  let cursor = 0;
  let segmentIndex = 0;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    let remaining = unit.duration;

    // Split this unit across multiple segments if needed
    while (remaining > 0) {
      const segDuration = Math.min(remaining, providerMaxDuration);
      const rounded = Math.round(segDuration * 100) / 100;

      plans.push({
        segmentIndex: segmentIndex++,
        unitIndex: i,
        action: unit.action,
        duration: rounded,
        startTime: Math.round(cursor * 100) / 100,
        endTime: Math.round((cursor + rounded) * 100) / 100,
      });

      cursor += rounded;
      remaining = Math.round((remaining - segDuration) * 100) / 100;
    }
  }

  return plans;
}

// ── Combined planner ──────────────────────────────────────────────────────

/**
 * Full motion plan: split prompt into units + map to generation segments.
 * This is the main entry point called by the API route.
 */
export async function planScene(
  prompt: string,
  totalDuration: number,
  segmentMaxDuration: number
): Promise<MotionPlan> {
  const units = await planMotionUnits(prompt, totalDuration, segmentMaxDuration);
  const segments = planSegmentDurations(units, segmentMaxDuration);

  return {
    units,
    segments,
    totalDuration,
    segmentCount: segments.length,
  };
}
