// GHS Auto-Timestamp Engine
//
// Spec: update/updated ff/AUTO_TIME_STAMP_FUNCTION_SPEC.md
//
// Converts scenes / script segments into a deterministic timeline:
//   startTime, endTime, duration per segment
//   → fed into AssemblyJSON.narration[].startTime and segments[].duration
//
// Two modes:
//   computeSceneTimeline  — scene-first (movie / commercial / children / series)
//   computeScriptTimeline — script-first (hybrid, parsed screenplay segments)

// ── Constants ────────────────────────────────────────────────────────────────

// Piper TTS at speed 0.75 ≈ 13 chars/sec spoken
const DEFAULT_CHARS_PER_SEC = 13;

// Pause added after each narration chunk (natural breath)
const NARRATION_PAUSE_SEC = 0.4;

// Minimum scene duration regardless of narration length
const MIN_SCENE_DURATION_SEC = 3;

// ── Scene-first timeline ─────────────────────────────────────────────────────

export interface SceneInput {
  id: string;
  narrationText?: string;   // text that will be spoken over this scene
  durationMs?: number;      // measured audio duration (overrides text estimate)
  fixedDuration?: number;   // user-set fixed duration in seconds (overrides everything)
}

export interface TimedScene {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;         // seconds
  narrationText: string;
}

export interface SceneTimeline {
  scenes: TimedScene[];
  totalDuration: number;
}

/**
 * computeSceneTimeline
 *
 * Given an ordered list of scenes (with optional narration text),
 * returns a timeline where each scene's duration is driven by:
 *   1. fixedDuration (user set)  — highest priority
 *   2. durationMs (measured TTS) — medium priority
 *   3. text length estimation    — fallback
 *
 * @param scenes      Ordered scene inputs
 * @param piperSpeed  TTS speed multiplier (default 0.75). Higher = faster speech = shorter scenes.
 * @param targetTotal Optional target total duration in seconds. If supplied, scenes are scaled
 *                    proportionally to hit the target.
 */
export function computeSceneTimeline(
  scenes: SceneInput[],
  piperSpeed = 0.75,
  targetTotal?: number
): SceneTimeline {
  if (scenes.length === 0) return { scenes: [], totalDuration: 0 };

  const charsPerSec = DEFAULT_CHARS_PER_SEC * (piperSpeed / 0.75);

  // Step 1 — estimate raw duration per scene
  const rawDurations = scenes.map(s => {
    if (s.fixedDuration && s.fixedDuration > 0) return s.fixedDuration;
    if (s.durationMs && s.durationMs > 0) return s.durationMs / 1000 + NARRATION_PAUSE_SEC;
    const text = s.narrationText?.trim() || "";
    if (!text) return MIN_SCENE_DURATION_SEC;
    const estimated = text.length / charsPerSec + NARRATION_PAUSE_SEC;
    return Math.max(MIN_SCENE_DURATION_SEC, estimated);
  });

  const rawTotal = rawDurations.reduce((a, b) => a + b, 0);

  // Step 2 — scale to target if requested
  const scale = targetTotal && targetTotal > 0 && rawTotal > 0
    ? targetTotal / rawTotal
    : 1;

  // Step 3 — build timeline
  const timedScenes: TimedScene[] = [];
  let cursor = 0;

  scenes.forEach((s, i) => {
    const duration = rawDurations[i] * scale;
    timedScenes.push({
      id: s.id,
      startTime: cursor,
      endTime: cursor + duration,
      duration,
      narrationText: s.narrationText || "",
    });
    cursor += duration;
  });

  return { scenes: timedScenes, totalDuration: cursor };
}

// ── Script-first timeline ────────────────────────────────────────────────────
// Used by hybrid planner and any planner with parsed screenplay segments.

export interface ScriptSegmentInput {
  id: string;
  type: "narration" | "dialogue" | "action" | string;
  text: string;
  durationMs?: number | null;
}

export interface TimedSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ScriptTimeline {
  segments: TimedSegment[];
  totalDuration: number;
  /** convenience: array of startTimes in same order as input — mirrors hybrid buildTimings() output */
  startTimes: number[];
}

/**
 * computeScriptTimeline
 *
 * Converts a parsed screenplay segment list into per-segment timing.
 * Narration segments advance the elapsed clock; dialogue segments use
 * a shorter pause (their audio clips are placed separately at scene start).
 *
 * Drop-in replacement for hybrid-planner's buildTimings().
 */
export function computeScriptTimeline(
  segments: ScriptSegmentInput[],
  piperSpeed = 0.75
): ScriptTimeline {
  const charsPerSec = DEFAULT_CHARS_PER_SEC * (piperSpeed / 0.75);
  const timedSegments: TimedSegment[] = [];
  const startTimes: number[] = [];
  let elapsed = 0;

  for (const seg of segments) {
    startTimes.push(elapsed);
    const durSec = seg.durationMs
      ? seg.durationMs / 1000
      : seg.text.length / charsPerSec;
    const pause = seg.type === "narration" ? 0.3 : 0.2;
    const duration = durSec + pause;
    timedSegments.push({
      id: seg.id,
      startTime: elapsed,
      endTime: elapsed + duration,
      duration,
    });
    elapsed += duration;
  }

  return { segments: timedSegments, totalDuration: elapsed, startTimes };
}

// ── Timeline Plan (used by /api/timeline/plan) ───────────────────────────────

export type TimingMode = "narration" | "scene" | "hybrid";

export interface ScriptInput {
  script: string;
  scenes?: string[];
  mode: TimingMode;
  targetDuration: number;
  durationHints?: Record<string, number>;
}

export interface TimingSegment {
  id: string;
  title: string;
  narrationText: string;
  startTime: number;
  endTime: number;
  duration: number;
  sceneIndex?: number;
  visualInstruction?: string;
}

export interface TimingPlan {
  projectId?: string;
  mode: TimingMode;
  targetDuration: number;
  totalDuration: number;
  segments: TimingSegment[];
}

function splitScript(
  script: string,
  mode: TimingMode,
  scenes?: string[]
): Array<{ id: string; title: string; text: string }> {
  if (mode === "scene" && scenes && scenes.length > 0) {
    return scenes.map((s, i) => ({ id: `seg_${i + 1}`, title: `Scene ${i + 1}`, text: s }));
  }
  const paragraphs = script.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  if (paragraphs.length > 1) {
    return paragraphs.map((p, i) => ({ id: `seg_${i + 1}`, title: `Segment ${i + 1}`, text: p }));
  }
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
  return sentences.filter(s => s.trim()).map((s, i) => ({
    id: `seg_${i + 1}`,
    title: `Segment ${i + 1}`,
    text: s.trim(),
  }));
}

/**
 * buildTimingPlan
 *
 * Converts a script + optional scene list into a timed segment plan scaled to targetDuration.
 */
export function buildTimingPlan(input: ScriptInput, projectId?: string): TimingPlan {
  const { script, scenes, mode, targetDuration, durationHints } = input;
  const chunks = splitScript(script, mode, scenes);

  const rawDurations = chunks.map(c => {
    if (durationHints?.[c.id] && durationHints[c.id] > 0) return durationHints[c.id];
    const est = c.text.length / DEFAULT_CHARS_PER_SEC + NARRATION_PAUSE_SEC;
    return Math.max(MIN_SCENE_DURATION_SEC, est);
  });

  const rawTotal = rawDurations.reduce((a, b) => a + b, 0);
  const scale = rawTotal > 0 ? targetDuration / rawTotal : 1;

  const segments: TimingSegment[] = [];
  let cursor = 0;

  chunks.forEach((c, i) => {
    const duration = rawDurations[i] * scale;
    segments.push({
      id: c.id,
      title: c.title,
      narrationText: c.text,
      startTime: cursor,
      endTime: cursor + duration,
      duration,
      sceneIndex: i,
    });
    cursor += duration;
  });

  return { projectId, mode, targetDuration, totalDuration: cursor, segments };
}

/**
 * mergeAiEnrichment
 *
 * Merges AI-generated visual instructions into an existing TimingPlan.
 */
export function mergeAiEnrichment(
  plan: TimingPlan,
  enrichments: Array<{ segmentId: string; title?: string; visualInstruction: string }>
): TimingPlan {
  const enrichMap = new Map(enrichments.map(e => [e.segmentId, e]));
  return {
    ...plan,
    segments: plan.segments.map(s => {
      const e = enrichMap.get(s.id);
      if (!e) return s;
      return { ...s, visualInstruction: e.visualInstruction, ...(e.title ? { title: e.title } : {}) };
    }),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * estimateTextDuration
 * Returns estimated spoken duration in seconds for a block of text.
 */
export function estimateTextDuration(text: string, piperSpeed = 0.75): number {
  const charsPerSec = DEFAULT_CHARS_PER_SEC * (piperSpeed / 0.75);
  return Math.max(MIN_SCENE_DURATION_SEC, text.length / charsPerSec);
}

/**
 * buildNarrationEntries
 *
 * Given a scene timeline + a map of sceneId→audioUrl,
 * returns narration entries ready for AssemblyJSON.narration[].
 * Only scenes that have an audio URL are included.
 */
export function buildNarrationEntries(
  timeline: SceneTimeline,
  audioMap: Record<string, string>,
  volume = 1.0
): Array<{ id: string; audioUrl: string; startTime: number; endTime: number; volume: number; text: string; speed: number }> {
  return timeline.scenes
    .filter(s => audioMap[s.id])
    .map(s => ({
      id: `nar_${s.id}`,
      audioUrl: audioMap[s.id],
      startTime: s.startTime,
      endTime: s.endTime,
      volume,
      text: s.narrationText,
      speed: 1.0,
    }));
}
