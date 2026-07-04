// multiTopic.ts — parse a multi-topic children video instruction into segments.
//
// WHY (Henry 2026-07-03): a request like
//   "4 TOPIC - 60 MIN - SPELLING 2 TO 5 LETTER WORDS 20 MIN - ALPHABET WITH
//    IMAGE 10 MIN - PLAY EDUCATION 15 MIN - BED TIME STORIES 3 STORIES"
// was structurally unrepresentable: the children data model carried ONE mode +
// ONE targetSeconds, so the whole instruction fell into the generic LLM story
// path and produced nonsense. This module turns the instruction into ordered
// segments [{kind, targetSeconds, …}] the planner builds one at a time
// (deterministic card builders for teaching kinds, LLM story path per story).
//
// Deterministic + typo-tolerant (real input had "APHABET", "BED TIME STORE",
// "EDUCTATION") — keyword stems, not exact words. Pure functions, no I/O.

import { detectSceneOutline, parseAuthoredScript } from "../story/authoredScript";

export type TopicKind = "spelling" | "abc" | "counting" | "concept" | "story" | "play";

export interface TopicSegment {
  label: string; // the user's own words for this topic (trimmed chunk)
  kind: TopicKind;
  targetSeconds: number; // explicit "N min" from the chunk, else share of remainder
  storyCount?: number; // "3 stories" → 3 separate demarcated stories
  wordLengthMin?: number; // spelling "2 to 5 letter" → 2
  wordLengthMax?: number; // → 5
}

export interface MultiTopicPlan {
  totalSeconds: number; // explicit standalone total ("60 MIN") wins, else sum
  segments: TopicSegment[];
}

// Chunk duration: the LAST "N min/minutes" in a chunk (skips counts like
// "2 to 5 letter"). Hours accepted for completeness.
function chunkSeconds(chunk: string): number {
  const hours = [...chunk.matchAll(/(\d+)\s*hours?\b/gi)];
  if (hours.length > 0) return parseInt(hours[hours.length - 1][1]) * 3600;
  const mins = [...chunk.matchAll(/(\d+)\s*min(?:ute)?s?\b/gi)];
  if (mins.length > 0) return parseInt(mins[mins.length - 1][1]) * 60;
  return 0;
}

// Keyword stems → kind. Order matters: "bed time story" must win over the
// generic teaching words, and spelling ("letter words") over abc ("alphabet").
function classifyChunk(chunk: string): TopicKind | null {
  const c = chunk.toLowerCase();
  if (/bed\s*time|stor(?:y|ies|e|es)\b|tale/.test(c)) return "story";
  if (/spell|letters?\s*words?|\d\s*letters?\b/.test(c)) return "spelling";
  if (/alphabet|aphabet|\babc\b|phabet/.test(c)) return "abc";
  if (/count|number|\bmaths?\b/.test(c)) return "counting";
  if (/colou?r|shape|animal|feeling|body|first\s*word/.test(c)) return "concept";
  if (/play|school|teach|class|student|educat/.test(c)) return "play";
  return null;
}

// Spelling word-length spec: "2 to 5 letter", "4,5,6 letters", "4-5 letter".
function parseWordLengths(c: string): { min?: number; max?: number } {
  const range = c.match(/(\d+)\s*(?:to|[-–—])\s*(\d+)\s*letters?/);
  if (range) return { min: parseInt(range[1]), max: parseInt(range[2]) };
  const list = c.match(/((?:\d\s*,\s*)+\d)\s*letters?/);
  if (list) {
    const nums = list[1].split(/\s*,\s*/).map(Number).filter(n => n >= 2 && n <= 9);
    if (nums.length) return { min: Math.min(...nums), max: Math.max(...nums) };
  }
  const single = c.match(/(\d)\s*letters?\b/);
  if (single) return { min: parseInt(single[1]), max: parseInt(single[1]) };
  return {};
}

/**
 * Scene-by-scene OUTLINE → segmented plan (Henry 2026-07-04). Input like:
 *   "I need a 60 minute video with 6 scenes …
 *    scene 1: 4,5,6 letter words
 *    scene 2: story about a man on a long journey A to Z …
 *    scene 3: math …"
 * Each outlined scene becomes a segment: teaching labels hit the deterministic
 * card engines, "story …" labels become LLM stories (the user's own subject
 * line is preserved as the story brief), everything else becomes an LLM
 * lesson on the user's words. A compound scene ("why we need a doctor and
 * 2 bed time story") splits into lesson + stories. Total duration comes from
 * the preamble ("60 minute video"); scenes without their own time share it.
 */
export function parseSceneOutlineToPlan(text: string): MultiTopicPlan | null {
  if (!detectSceneOutline(text)) return null;
  const parsed = parseAuthoredScript(text);
  if (parsed.scenes.length < 2) return null;

  // Preamble = everything before the first "scene 1" header — holds the total.
  const firstHeaderIdx = text.search(/scene\s+\d/i);
  const preamble = firstHeaderIdx > 0 ? text.slice(0, firstHeaderIdx) : "";
  const explicitTotal = chunkSeconds(preamble);

  const segments: TopicSegment[] = [];
  for (const sc of parsed.scenes) {
    const label = [sc.title, sc.text].filter(Boolean).join(" ").trim();
    if (!label) continue;
    const authoredSec =
      sc.endSeconds !== undefined && sc.startSeconds !== undefined && sc.endSeconds > sc.startSeconds
        ? Math.round(sc.endSeconds - sc.startSeconds)
        : chunkSeconds(label);

    // Compound scene: "<lesson topic> and N (bed time) stories" → two segments.
    const storyMention = label.match(/(\d+)\s*(?:bed\s*time\s*)?stor(?:y|ies|e|es)/i);
    const beforeStory = storyMention ? label.slice(0, storyMention.index).replace(/\band\b\s*$/i, "").trim() : "";
    if (storyMention && beforeStory.split(/\s+/).length >= 3 && !/^stor/i.test(beforeStory)) {
      const half = authoredSec > 0 ? Math.round(authoredSec / 2) : 0;
      const lessonKind = classifyChunk(beforeStory) || "play";
      const lessonSeg: TopicSegment = { label: beforeStory, kind: lessonKind, targetSeconds: half };
      if (lessonKind === "spelling") {
        const wl = parseWordLengths(beforeStory.toLowerCase());
        if (wl.min) { lessonSeg.wordLengthMin = wl.min; lessonSeg.wordLengthMax = wl.max ?? wl.min; }
      }
      segments.push(lessonSeg);
      segments.push({
        label: label.slice(storyMention.index || 0),
        kind: "story",
        targetSeconds: half,
        storyCount: Math.max(1, Math.min(10, parseInt(storyMention[1]))),
      });
      continue;
    }

    const kind = classifyChunk(label) || "play"; // unknown subject → LLM lesson on the user's words
    const seg: TopicSegment = { label, kind, targetSeconds: authoredSec };
    if (kind === "story") {
      const count = label.toLowerCase().match(/(\d+)\s*stor/);
      if (count) seg.storyCount = Math.max(1, Math.min(10, parseInt(count[1])));
    }
    if (kind === "spelling") {
      const wl = parseWordLengths(label.toLowerCase());
      if (wl.min) { seg.wordLengthMin = wl.min; seg.wordLengthMax = wl.max ?? wl.min; }
    }
    segments.push(seg);
  }
  if (segments.length < 2) return null;

  const assigned = segments.reduce((s, seg) => s + seg.targetSeconds, 0);
  if (!explicitTotal && assigned === 0) return null;
  const unassigned = segments.filter(s => s.targetSeconds === 0);
  if (unassigned.length > 0) {
    const pool = Math.max(0, (explicitTotal || assigned) - assigned);
    const share = pool > 0 ? Math.round(pool / unassigned.length) : 300;
    for (const seg of unassigned) seg.targetSeconds = share;
  }
  const total = Math.max(explicitTotal, segments.reduce((s, seg) => s + seg.targetSeconds, 0));
  return { totalSeconds: total, segments };
}

/**
 * Parse a multi-topic instruction. Returns null when the text is NOT a
 * multi-topic brief (fewer than 2 classified topics, or no duration signal
 * at all) — callers then fall through to their existing single-topic paths.
 */
export function parseMultiTopicInstruction(text: string): MultiTopicPlan | null {
  if (!text || text.length < 20) return null;

  // Scene-by-scene outline form ("scene 1: math") takes precedence — the
  // user demarcated the segments themselves, so honor that structure exactly.
  const outline = parseSceneOutlineToPlan(text);
  if (outline) return outline;

  // Chunks split on dash runs / newlines / semicolons — the natural separators
  // people use when listing topics ("A 20 MIN - B 10 MIN --- C 15 MIN").
  const chunks = text
    .split(/\s+-{1,3}\s*|\s*-{2,3}\s+|\n+|;/)
    .map(c => c.trim())
    .filter(c => c.length > 0);
  // At least 2 chunks — a meta header ("4 topics") is optional, so a bare
  // "spelling 10 min - bedtime story 10 min" brief must not be rejected here;
  // the segments.length < 2 guard below is the real multi-topic test.
  if (chunks.length < 2) return null;

  let explicitTotal = 0;
  const segments: TopicSegment[] = [];

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    // Meta chunks: "4 topics" (announces the count), pure formatting notes.
    if (/^\d+\s*topics?$/.test(lower)) continue;
    // A standalone duration chunk is the TOTAL runtime ("60 MIN").
    if (/^\d+\s*(?:min(?:ute)?s?|hours?)$/.test(lower)) {
      explicitTotal = chunkSeconds(chunk);
      continue;
    }

    const kind = classifyChunk(chunk);
    if (!kind) continue; // instructions like "scene by scene, action verbs" ride along

    const seg: TopicSegment = { label: chunk, kind, targetSeconds: chunkSeconds(chunk) };

    if (kind === "story") {
      const count = lower.match(/(\d+)\s*stor/);
      if (count) seg.storyCount = Math.max(1, Math.min(10, parseInt(count[1])));
    }
    if (kind === "spelling") {
      const range = lower.match(/(\d+)\s*(?:to|[-–—])\s*(\d+)\s*letter/);
      if (range) {
        seg.wordLengthMin = parseInt(range[1]);
        seg.wordLengthMax = parseInt(range[2]);
      }
    }
    segments.push(seg);
  }

  if (segments.length < 2) return null;

  const assigned = segments.reduce((s, seg) => s + seg.targetSeconds, 0);
  if (!explicitTotal && assigned === 0) return null; // no duration signal anywhere

  // Segments without their own duration share the unassigned remainder
  // (e.g. "60 MIN total, 20+10+15 assigned → bedtime stories get 15").
  const unassigned = segments.filter(s => s.targetSeconds === 0);
  if (unassigned.length > 0) {
    const pool = Math.max(0, (explicitTotal || assigned) - assigned);
    const share = pool > 0 ? Math.round(pool / unassigned.length) : 300; // default 5 min each
    for (const seg of unassigned) seg.targetSeconds = share;
  }

  const total = Math.max(explicitTotal, segments.reduce((s, seg) => s + seg.targetSeconds, 0));
  return { totalSeconds: total, segments };
}
