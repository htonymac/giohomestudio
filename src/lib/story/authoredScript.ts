// authoredScript.ts — detect + parse a user-pasted, already-written scene script.
//
// WHY THIS EXISTS (Henry 2026-07-03): users author full scripts elsewhere
// (ChatGPT etc.) in the shape "**Scene 1 — Spelling Warm-Up, 0–4 Minutes:**
// one paragraph…" and paste them into a planner. Before this module, every
// entry point re-ran the paste through /api/hybrid/story-expand — which
// treats ANY input as a "brief story idea" and rewrites it to its own word
// target — and /api/hybrid/scene-plan then collapsed the result to its
// hardcoded 5-10 scenes. An 18-scene 60-minute script became a ~2-minute
// nonsense story. This module lets planners recognize an authored script
// and use it VERBATIM: scene demarcation, per-scene text, and per-scene
// timing all preserved, no LLM rewrite.
//
// Used by: children-planner expandStory/expandContent, hybrid-planner
// expandStory. Pure functions, no I/O — safe to unit-test with plain node.

export interface AuthoredScene {
  index: number; // 1-based scene number as authored
  title: string; // header title, "" when the header has none
  startSeconds?: number; // from "X–Y Minutes" ranges when present
  endSeconds?: number;
  durationSeconds: number; // authored range, else narration-length estimate
  text: string; // the scene's full authored paragraph(s), untouched
}

export interface AuthoredScript {
  scenes: AuthoredScene[];
  totalSeconds: number;
}

// Scene headers appear at line starts, optionally wrapped in markdown
// (** / ## / __) — "Scene 12", "SCENE 3:", "**Scene 1 — Title, 0–4 Minutes:**".
// The \b stops "scenery"; requiring line-start stops prose like "…in scene 3".
const HEADER_RE = /(?:^|\n)[^\S\n]*(?:\*\*|__|#{1,4}[^\S\n]*|>[^\S\n]*)?scene[^\S\n]+(\d{1,3})\b/gi;

// "0–4 Minutes" / "4-8 min" / "55–60 minutes" / "30-45 seconds".
// ChatGPT emits en-dashes (–) — the old planner regex only matched ASCII "-"
// and mis-parsed every pasted range, so all three dash forms are accepted.
const TIME_RANGE_RE = /(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|seconds?|secs?)\b/i;

// Fallback when a scene has no authored time range: narration speaking pace.
// ~2.4 words/sec ≈ 145 wpm, the usual calm-narrator rate.
const WORDS_PER_SECOND = 2.4;

export function estimateSceneSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.round(words / WORDS_PER_SECOND));
}

interface HeaderHit {
  sceneNumber: number;
  headerStart: number; // index of "scene" token region start (after \n)
  bodyStart: number; // index right after the matched header token
}

function findHeaders(text: string): HeaderHit[] {
  const hits: HeaderHit[] = [];
  HEADER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADER_RE.exec(text)) !== null) {
    const leadingNewline = m[0].startsWith("\n") ? 1 : 0;
    hits.push({
      sceneNumber: parseInt(m[1], 10),
      headerStart: m.index + leadingNewline,
      bodyStart: m.index + m[0].length,
    });
  }
  return hits;
}

/**
 * True when the pasted text is an already-authored scene script that must be
 * used verbatim (>=2 scene headers, mostly-ascending numbering so prose that
 * merely mentions "scene 3" once doesn't trip it).
 */
export function detectAuthoredScript(text: string): boolean {
  if (!text || text.length < 80) return false;
  const hits = findHeaders(text);
  if (hits.length < 2) return false;
  let ascending = 0;
  for (let i = 1; i < hits.length; i++) {
    if (hits[i].sceneNumber > hits[i - 1].sceneNumber) ascending++;
  }
  // e.g. 18 headers -> 17 gaps, need >=12 ascending; 2 headers need 1.
  return ascending >= Math.max(1, Math.ceil((hits.length - 1) * 0.7));
}

function parseTimeRange(headerLine: string): { start?: number; end?: number } {
  const t = headerLine.match(TIME_RANGE_RE);
  if (!t) return {};
  const unit = t[3].toLowerCase().startsWith("min") ? 60 : 1;
  return { start: parseFloat(t[1]) * unit, end: parseFloat(t[2]) * unit };
}

function cleanTitle(raw: string): string {
  return raw
    .replace(TIME_RANGE_RE, "") // drop the "X–Y Minutes" part
    .replace(/\(\s*\)|\[\s*\]/g, "") // parens/brackets left empty by the range strip — "The Meeting ()"
    .replace(/[*_#>]+/g, "") // markdown emphasis
    .replace(/^[\s—–\-:.,]+|[\s—–\-:.,]+$/g, "") // stray separators
    .trim();
}

/**
 * Split an authored script into its scenes, preserving each scene's full
 * text and authored timing. Body text on the same line as the header
 * ("…Minutes:** Create one bright classroom image where…") is kept.
 */
export function parseAuthoredScript(text: string): AuthoredScript {
  const hits = findHeaders(text);
  const scenes: AuthoredScene[] = [];

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const segmentEnd = i + 1 < hits.length ? hits[i + 1].headerStart : text.length;
    const afterNumber = text.slice(hit.bodyStart, segmentEnd);

    // Header remainder = rest of the header's own line (title + time range).
    const nlIdx = afterNumber.indexOf("\n");
    const headerRest = nlIdx === -1 ? afterNumber : afterNumber.slice(0, nlIdx);
    const { start, end } = parseTimeRange(headerRest);

    // Scene body: same-line text after the header's closing ":"/":**" if any,
    // plus all following lines up to the next header.
    let sameLineBody = "";
    let titlePart = headerRest;
    const timeMatch = headerRest.match(TIME_RANGE_RE);
    const splitFrom = timeMatch ? (timeMatch.index ?? 0) + timeMatch[0].length : 0;
    const colonIdx = headerRest.indexOf(":", splitFrom);
    if (colonIdx !== -1) {
      titlePart = headerRest.slice(0, colonIdx);
      sameLineBody = headerRest.slice(colonIdx + 1).replace(/^\*\*|^__/, "").trim();
    }
    const followingLines = nlIdx === -1 ? "" : afterNumber.slice(nlIdx + 1);
    const body = [sameLineBody, followingLines.trim()].filter(Boolean).join("\n").trim();

    const authoredDur =
      start !== undefined && end !== undefined && end > start ? Math.round(end - start) : undefined;

    scenes.push({
      index: hit.sceneNumber,
      title: cleanTitle(titlePart),
      startSeconds: start,
      endSeconds: end,
      durationSeconds: authoredDur ?? estimateSceneSeconds(body),
      text: body,
    });
  }

  // Total: trust the authored timeline when the last range is well-formed
  // (endSeconds beats summing — authors write "55–60" meaning a 60-min video).
  const last = scenes[scenes.length - 1];
  const summed = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
  const totalSeconds =
    last?.endSeconds !== undefined && last.endSeconds >= summed * 0.5 ? Math.round(last.endSeconds) : summed;

  return { scenes, totalSeconds };
}
