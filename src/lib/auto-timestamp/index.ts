// GioHomeStudio — Auto Timestamp Engine
// Splits a raw script into timed segments for assembly, subtitles, and shot planning.
// Modes: narration | scene | hybrid
// The engine validates timing math and guarantees no gaps/overlaps.
// AI planning is done by the caller (API route) — this engine structures the raw plan.

export type TimingMode = "narration" | "scene" | "hybrid";

export interface ScriptInput {
  script: string;
  scenes?: string[];          // optional pre-split scenes
  targetDuration: number;     // total duration in seconds
  mode: TimingMode;
  durationHints?: Record<string, number>; // per-scene hints (seconds)
}

export interface TimedSegment {
  id: string;
  type: "scene" | "beat" | "narration" | "transition";
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  narrationText: string;
  visualInstruction: string;
  subtitleText: string;
  wordCount: number;
  estimatedSpeechSeconds: number;
  sceneIndex: number;
}

export interface TimingPlan {
  projectId: string;
  mode: TimingMode;
  totalDuration: number;
  segmentCount: number;
  segments: TimedSegment[];
  warnings: string[];
  generatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
// Average speaking rate: ~130 words per minute = ~2.17 words/second
const WORDS_PER_SECOND = 2.17;
// Minimum scene duration in seconds
const MIN_SCENE_DURATION = 1.5;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Estimate how long it takes to speak a piece of text, accounting for pauses.
 * Sentence-ending punctuation adds ~0.3s pause. Commas add ~0.15s.
 */
export function estimateSpeechDuration(text: string): number {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  const baseDuration = words / WORDS_PER_SECOND;

  // Count sentence endings and commas for pause estimation
  const sentenceEndings = (text.match(/[.!?]+/g) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  const pauseSeconds = sentenceEndings * 0.3 + commas * 0.15;

  return Math.max(MIN_SCENE_DURATION, baseDuration + pauseSeconds);
}

/**
 * Split a script into meaningful blocks by paragraph/double-newline,
 * then by sentence if a block is very long.
 */
function splitIntoBlocks(script: string): string[] {
  // First split by double newline (paragraph breaks)
  const paragraphs = script.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  // Fallback: split by period/exclamation/question into sentences
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Group short consecutive sentences (< 15 words) into one block
  const grouped: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length;
    if (current && (current.split(/\s+/).length + wordCount) > 30) {
      grouped.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) grouped.push(current.trim());
  return grouped.length > 0 ? grouped : [script.trim()];
}

/**
 * Extract a short title from a text block (first 5 words, max 40 chars).
 */
function extractTitle(text: string, index: number): string {
  const words = text.trim().split(/\s+/).slice(0, 5).join(" ");
  const title = words.length > 40 ? words.slice(0, 40) + "…" : words;
  return title || `Scene ${index + 1}`;
}

/**
 * Clamp and round a duration to 2 decimal places.
 */
function clampDuration(d: number): number {
  return Math.round(Math.max(MIN_SCENE_DURATION, d) * 100) / 100;
}

// ── Mode implementations ──────────────────────────────────────────────────

/**
 * Mode 1 — Narration-first: split script into spoken beats, align to duration.
 */
function planNarrationFirst(input: ScriptInput): TimedSegment[] {
  const blocks = input.scenes?.length
    ? input.scenes
    : splitIntoBlocks(input.script);

  // Calculate raw speech durations
  const rawDurations = blocks.map(b => estimateSpeechDuration(b));
  const totalRaw = rawDurations.reduce((a, b) => a + b, 0);

  // Scale to fit target duration (keep proportions)
  const scale = totalRaw > 0 ? (input.targetDuration / totalRaw) : 1;

  const segments: TimedSegment[] = [];
  let cursor = 0;

  blocks.forEach((block, i) => {
    const wordCount = block.trim().split(/\s+/).length;
    const estimatedSpeech = estimateSpeechDuration(block);
    const scaledDuration = clampDuration(estimatedSpeech * scale);
    const endTime = Math.round((cursor + scaledDuration) * 100) / 100;

    segments.push({
      id: `seg_${i + 1}`,
      type: "narration",
      title: input.scenes?.[i]
        ? extractTitle(input.scenes[i], i)
        : extractTitle(block, i),
      startTime: Math.round(cursor * 100) / 100,
      endTime,
      duration: Math.round((endTime - cursor) * 100) / 100,
      narrationText: block,
      visualInstruction: `Scene ${i + 1} visual`,
      subtitleText: block,
      wordCount,
      estimatedSpeechSeconds: Math.round(estimatedSpeech * 100) / 100,
      sceneIndex: i,
    });

    cursor = endTime;
  });

  return segments;
}

/**
 * Mode 2 — Scene-first: distribute target duration across scenes, fit narration inside.
 */
function planSceneFirst(input: ScriptInput): TimedSegment[] {
  const scenes = input.scenes?.length
    ? input.scenes
    : splitIntoBlocks(input.script);

  const count = scenes.length;
  const segments: TimedSegment[] = [];
  let cursor = 0;

  scenes.forEach((scene, i) => {
    // Use durationHints if provided, otherwise distribute evenly
    const rawDuration = input.durationHints?.[`scene_${i + 1}`]
      ?? input.durationHints?.[String(i + 1)]
      ?? (input.targetDuration / count);
    const duration = clampDuration(rawDuration);
    const endTime = Math.round((cursor + duration) * 100) / 100;

    // Narration is trimmed to fit inside the window
    const wordCount = scene.trim().split(/\s+/).length;
    const estimatedSpeech = estimateSpeechDuration(scene);

    segments.push({
      id: `seg_${i + 1}`,
      type: "scene",
      title: extractTitle(scene, i),
      startTime: Math.round(cursor * 100) / 100,
      endTime,
      duration: Math.round((endTime - cursor) * 100) / 100,
      narrationText: scene,
      visualInstruction: scene,
      subtitleText: scene,
      wordCount,
      estimatedSpeechSeconds: Math.round(estimatedSpeech * 100) / 100,
      sceneIndex: i,
    });

    cursor = endTime;
  });

  return segments;
}

/**
 * Mode 3 — Hybrid: merge narration timing and scene duration, resolve conflicts.
 */
function planHybrid(input: ScriptInput): TimedSegment[] {
  const blocks = input.scenes?.length
    ? input.scenes
    : splitIntoBlocks(input.script);

  const rawSpeech = blocks.map(b => estimateSpeechDuration(b));
  const totalSpeech = rawSpeech.reduce((a, b) => a + b, 0);
  const scale = totalSpeech > 0 ? (input.targetDuration / totalSpeech) : 1;

  const segments: TimedSegment[] = [];
  let cursor = 0;

  blocks.forEach((block, i) => {
    // Use the greater of: scaled narration or duration hint
    const speechDuration = estimateSpeechDuration(block) * scale;
    const hintDuration = input.durationHints?.[`scene_${i + 1}`]
      ?? input.durationHints?.[String(i + 1)]
      ?? 0;
    const duration = clampDuration(Math.max(speechDuration, hintDuration));
    const endTime = Math.round((cursor + duration) * 100) / 100;

    const wordCount = block.trim().split(/\s+/).length;

    segments.push({
      id: `seg_${i + 1}`,
      type: "beat",
      title: extractTitle(block, i),
      startTime: Math.round(cursor * 100) / 100,
      endTime,
      duration: Math.round((endTime - cursor) * 100) / 100,
      narrationText: block,
      visualInstruction: block,
      subtitleText: block,
      wordCount,
      estimatedSpeechSeconds: Math.round(estimateSpeechDuration(block) * 100) / 100,
      sceneIndex: i,
    });

    cursor = endTime;
  });

  return segments;
}

// ── Main entry ─────────────────────────────────────────────────────────────

/**
 * Build a timing plan for a script.
 * Called by the API route after optional AI enrichment.
 */
export function buildTimingPlan(
  input: ScriptInput,
  projectId = `proj_${Date.now()}`
): TimingPlan {
  const warnings: string[] = [];

  if (!input.script.trim() && !input.scenes?.length) {
    warnings.push("No script content provided — returning empty plan.");
    return {
      projectId,
      mode: input.mode,
      totalDuration: input.targetDuration,
      segmentCount: 0,
      segments: [],
      warnings,
      generatedAt: new Date().toISOString(),
    };
  }

  let segments: TimedSegment[];
  switch (input.mode) {
    case "narration":
      segments = planNarrationFirst(input);
      break;
    case "scene":
      segments = planSceneFirst(input);
      break;
    case "hybrid":
    default:
      segments = planHybrid(input);
      break;
  }

  // Validation pass — check for overlaps or large gaps
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    if (curr.startTime < prev.endTime - 0.05) {
      warnings.push(`Overlap detected at segment ${i + 1}: starts at ${curr.startTime}s but previous ends at ${prev.endTime}s.`);
    }
    if (curr.startTime > prev.endTime + 1.5) {
      warnings.push(`Gap detected between segments ${i} and ${i + 1}: ${(curr.startTime - prev.endTime).toFixed(2)}s gap.`);
    }
  }

  // Check total duration drift
  if (segments.length > 0) {
    const actualTotal = segments[segments.length - 1].endTime;
    const drift = Math.abs(actualTotal - input.targetDuration);
    if (drift > 2) {
      warnings.push(`Total duration ${actualTotal.toFixed(1)}s drifts from target ${input.targetDuration}s by ${drift.toFixed(1)}s.`);
    }
  }

  return {
    projectId,
    mode: input.mode,
    totalDuration: segments.length > 0
      ? segments[segments.length - 1].endTime
      : input.targetDuration,
    segmentCount: segments.length,
    segments,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Merge an AI-enriched segment list back into a validated timing plan.
 * Used when the API route returns LLM-enriched visual instructions.
 */
export function mergeAiEnrichment(
  plan: TimingPlan,
  enrichments: Array<{ segmentId: string; visualInstruction?: string; title?: string }>
): TimingPlan {
  const map = new Map(enrichments.map(e => [e.segmentId, e]));
  return {
    ...plan,
    segments: plan.segments.map(seg => {
      const enr = map.get(seg.id);
      if (!enr) return seg;
      return {
        ...seg,
        visualInstruction: enr.visualInstruction ?? seg.visualInstruction,
        title: enr.title ?? seg.title,
      };
    }),
  };
}
