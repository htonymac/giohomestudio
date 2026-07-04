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
  if (/spell/.test(c)) return "spelling";
  if (/alphabet|aphabet|\babc\b|phabet/.test(c)) return "abc";
  if (/count|number/.test(c)) return "counting";
  if (/colou?r|shape|animal|feeling|body|first\s*word/.test(c)) return "concept";
  if (/play|school|teach|class|student|educat/.test(c)) return "play";
  return null;
}

/**
 * Parse a multi-topic instruction. Returns null when the text is NOT a
 * multi-topic brief (fewer than 2 classified topics, or no duration signal
 * at all) — callers then fall through to their existing single-topic paths.
 */
export function parseMultiTopicInstruction(text: string): MultiTopicPlan | null {
  if (!text || text.length < 20) return null;

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
