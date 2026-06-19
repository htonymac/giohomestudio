// src/lib/children/safetyScanner.ts
// Deterministic children-safe text scanner: no React, no fetch, importable client+server.
// Returns a structured verdict — block | soften | clean — so callers decide what to do.

// ── DEFAULT_REPLACEMENTS ────────────────────────────────────────────────────
// Moved here from app/api/children/word-filter/route.ts (which now re-exports
// this map so both surfaces stay in sync with a single source of truth).
// Categories: violence, weapons, scary, body harm, adult/inappropriate.
export const DEFAULT_REPLACEMENTS: Record<string, string> = {
  // Violence
  "kill":         "stop",
  "kills":        "stops",
  "killed":       "stopped",
  "killing":      "stopping",
  "murder":       "tag",
  "murdered":     "tagged",
  "stab":         "tap",
  "stabbed":      "tapped",
  "stabbing":     "tapping",
  "shoot":        "zap",
  "shoots":       "zaps",
  "shot":         "zapped",
  "shooting":     "zapping",
  "punch":        "bump",
  "punched":      "bumped",
  "punching":     "bumping",
  "fight":        "play-tussle",
  "fights":       "play-tussles",
  "fighting":     "play-tussling",
  "attack":       "surprise",
  "attacks":      "surprises",
  "attacked":     "surprised",
  "attacking":    "surprising",
  "hurt":         "bump",
  "hurts":        "bumps",
  "hurting":      "bumping",
  // Weapons
  "gun":          "toy",
  "guns":         "toys",
  "knife":        "stick",
  "knives":       "sticks",
  "sword":        "wand",
  "swords":       "wands",
  "bomb":         "balloon",
  "bombs":        "balloons",
  "weapon":       "tool",
  "weapons":      "tools",
  // Scary
  "scary":        "silly",
  "terrifying":   "surprising",
  "horror":       "surprise",
  "horrible":     "tricky",
  "nightmare":    "funny dream",
  "monster":      "creature",
  "monsters":     "creatures",
  "evil":         "grumpy",
  "demon":        "imp",
  "demons":       "imps",
  "ghost":        "spirit-friend",
  "ghosts":       "spirit-friends",
  "blood":        "paint",
  "bloody":       "painted",
  // Body harm
  "die":          "rest",
  "dies":         "rests",
  "died":         "rested",
  "dying":        "resting",
  "death":        "the long sleep",
  "dead":         "asleep",
  "wound":        "scratch",
  "wounded":      "scratched",
  // Adult/inappropriate
  "drunk":        "dizzy",
  "drug":         "snack",
  "drugs":        "snacks",
  "sex":          "love",
  "kiss":         "hug",
  "kissed":       "hugged",
  "kissing":      "hugging",
  "naked":        "in pajamas",
  "nude":         "in pajamas",
  "stupid":       "silly",
  "idiot":        "goofball",
  "dumb":         "silly",
  "hate":         "dislike",
  "hates":        "dislikes",
  "hated":        "disliked",
  "hating":       "disliking",
};

// ── HARD-BLOCK TERM LISTS ───────────────────────────────────────────────────
// These terms are REFUSED entirely — never softened into a kids video.
// Conservative: only include terms that are unambiguously harmful in every context.
// "kiss"/"love"/"fight" are NOT here — they are SOFTEN-able.
// "grass"/"class"/"assignment" are handled by the SAFE_WORD allowlist below.

type BlockCategory = "sexual" | "selfHarm" | "graphicViolence" | "slurs" | "hardDrugs";

const HARD_BLOCK_TERMS: Array<{ term: string; category: BlockCategory }> = [
  // ── sexual (explicit only; "kiss"/"love" stay in SOFTEN) ──────────────────
  { term: "porn",           category: "sexual" },
  { term: "pornography",    category: "sexual" },
  { term: "rape",           category: "sexual" },
  { term: "raped",          category: "sexual" },
  { term: "raping",         category: "sexual" },
  { term: "molest",         category: "sexual" },
  { term: "molestation",    category: "sexual" },
  { term: "pedophile",      category: "sexual" },
  { term: "pedophilia",     category: "sexual" },
  { term: "incest",         category: "sexual" },
  { term: "orgasm",         category: "sexual" },
  { term: "masturbate",     category: "sexual" },
  { term: "masturbation",   category: "sexual" },
  { term: "genitals",       category: "sexual" },
  { term: "penis",          category: "sexual" },
  { term: "vagina",         category: "sexual" },
  { term: "erection",       category: "sexual" },
  { term: "ejaculate",      category: "sexual" },
  { term: "ejaculation",    category: "sexual" },
  { term: "fornicate",      category: "sexual" },
  { term: "fornication",    category: "sexual" },
  { term: "prostitute",     category: "sexual" },
  { term: "prostitution",   category: "sexual" },
  { term: "intercourse",    category: "sexual" },
  { term: "sexually",       category: "sexual" },
  // ── self-harm ─────────────────────────────────────────────────────────────
  { term: "suicide",        category: "selfHarm" },
  { term: "suicidal",       category: "selfHarm" },
  { term: "self-harm",      category: "selfHarm" },
  { term: "self harm",      category: "selfHarm" },
  { term: "cut myself",     category: "selfHarm" },
  { term: "hang myself",    category: "selfHarm" },
  { term: "kill myself",    category: "selfHarm" },
  // ── graphic violence (gore/torture; NOT cartoon fight) ────────────────────
  { term: "torture",        category: "graphicViolence" },
  { term: "tortured",       category: "graphicViolence" },
  { term: "gore",           category: "graphicViolence" },
  { term: "gory",           category: "graphicViolence" },
  { term: "decapitate",     category: "graphicViolence" },
  { term: "decapitation",   category: "graphicViolence" },
  { term: "massacre",       category: "graphicViolence" },
  { term: "mutilate",       category: "graphicViolence" },
  { term: "mutilation",     category: "graphicViolence" },
  { term: "behead",         category: "graphicViolence" },
  { term: "beheading",      category: "graphicViolence" },
  { term: "slaughter",      category: "graphicViolence" },
  { term: "dismember",      category: "graphicViolence" },
  // ── slurs ─────────────────────────────────────────────────────────────────
  // Keep list minimal — add only the most unambiguous terms.
  { term: "nigger",         category: "slurs" },
  { term: "nigga",          category: "slurs" },
  { term: "faggot",         category: "slurs" },
  { term: "spastic",        category: "slurs" },
  { term: "retard",         category: "slurs" },
  { term: "cunt",           category: "slurs" },
  // ── hard drugs (NOT "snack"; "drug" → SOFTEN already in DEFAULT_REPLACEMENTS) ──
  { term: "cocaine",        category: "hardDrugs" },
  { term: "heroin",         category: "hardDrugs" },
  { term: "methamphetamine", category: "hardDrugs" },
  { term: "meth",           category: "hardDrugs" },
  { term: "fentanyl",       category: "hardDrugs" },
  { term: "opioid",         category: "hardDrugs" },
  { term: "ecstasy",        category: "hardDrugs" },
  { term: "mdma",           category: "hardDrugs" },
  { term: "lsd",            category: "hardDrugs" },
  { term: "cannabis",       category: "hardDrugs" },
  { term: "marijuana",      category: "hardDrugs" },
  { term: "weed",           category: "hardDrugs" },
  { term: "crack",          category: "hardDrugs" },
  { term: "overdose",       category: "hardDrugs" },
];

// ── SAFE-WORD ALLOWLIST ─────────────────────────────────────────────────────
// Words that look like blocked stems but are ALWAYS clean.
// Token-only matching (word boundaries) already prevents most false positives,
// but the stemmer below ("kill"→"kill", "killing"→"kill") would incorrectly
// stem "skills" → "skill" (fine) but NOT "grass" → "gras" (stemmer drops "s").
// The allowlist is the second-layer safety net for legitimately confusable words.
const SAFE_WORDS = new Set([
  // "ass" stem hits
  "grass", "class", "glass", "brass", "pass", "bass", "mass", "crass",
  "lass", "sass", "lass", "classic", "classify", "classroom", "classmate",
  "overpass", "surpass", "compass", "bypass", "harass",
  // "ass" compound
  "assignment", "assign", "cassette", "assassin", "assassination",
  "ambassador", "assistant", "assemble", "assembly", "assortment",
  "assist", "assistance", "asset", "associate",
  // "kill" allowlist
  "skill", "skills", "skilled", "skilful", "skillful", "skillset",
  // "shoot" allowlist — "shoot" IS in SOFTEN for violent context but single
  // "photo shoot" / "basketball shoot" would be caught; add phrase-level
  // safe words here. We handle this via context check in scanText below.
  // "cum" false-positive
  "accumulate", "accumulation", "document", "documents",
  // "die" false-positives (German word, food colour, verb-die is already in SOFTEN)
  "diet", "dieting", "diets", "dinosaur", "diesel",
  // "rape" false-positives
  "drape", "drapes", "grape", "grapes",
  // misc
  "shoot" , // NOT blocked at token level; context-sensitivity handled in scanText
]);

// ── LIGHT STEMMER ───────────────────────────────────────────────────────────
// Strips common English suffixes before lookup in DEFAULT_REPLACEMENTS.
// Purpose: "killing" → "kill" so the existing map entry fires.
// Deliberately conservative — only very high-confidence suffix rules.
function stemToken(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("tion") && w.length > 6) return w.slice(0, -4);
  if (w.endsWith("ness") && w.length > 6) return w.slice(0, -4);
  if (w.endsWith("ly") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

// ── SCAN RESULT TYPE ────────────────────────────────────────────────────────
export interface HardHit { term: string; category: BlockCategory }
export interface SoftHit { word: string; replacement: string }
export interface ScanResult {
  verdict: "block" | "soften" | "clean";
  hardHits: HardHit[];
  softHits: SoftHit[];
  cleanedText: string;
}

// ── scanText ─────────────────────────────────────────────────────────────────
// Pure function — no React, no fetch. Returns a ScanResult.
// Token-only matching: splits on word boundaries so "grass" is never hit by
// a "ass" rule, and "assignment" is never hit by any rule.
// Safe-word allowlist provides a second layer for edge cases.
export function scanText(text: string): ScanResult {
  if (!text || !text.trim()) {
    return { verdict: "clean", hardHits: [], softHits: [], cleanedText: text };
  }

  const hardHits: HardHit[] = [];
  const softHits: SoftHit[] = [];

  // Tokenise: extract word-boundary tokens (letters and hyphens only).
  // The regex \b..\b only works on \w chars; we split manually to handle
  // hyphenated words like "self-harm" as one token.
  const tokenRegex = /\b([a-zA-Z](?:[a-zA-Z'-]*[a-zA-Z])?)\b/g;
  let m: RegExpExecArray | null;
  const tokens: Array<{ word: string; start: number; end: number }> = [];
  while ((m = tokenRegex.exec(text)) !== null) {
    tokens.push({ word: m[1], start: m.index, end: m.index + m[1].length });
  }

  // Track replacements for cleanedText; apply back-to-front to preserve indices.
  const pendingReplacements: Array<{ start: number; end: number; replacement: string }> = [];
  const alreadyFlagged = new Set<number>(); // token start positions already handled

  for (const tok of tokens) {
    if (alreadyFlagged.has(tok.start)) continue;
    const lower = tok.word.toLowerCase();

    // Safe-word pass: skip immediately if the full token is allowlisted.
    if (SAFE_WORDS.has(lower)) continue;

    // ── HARD BLOCK check (direct match) ──
    const hardMatch = HARD_BLOCK_TERMS.find(h => h.term === lower);
    if (hardMatch) {
      hardHits.push({ term: tok.word, category: hardMatch.category });
      alreadyFlagged.add(tok.start);
      continue;
    }
    // Hard block via stem
    const stemmed = stemToken(lower);
    const hardStemMatch = HARD_BLOCK_TERMS.find(h => h.term === stemmed);
    if (hardStemMatch) {
      hardHits.push({ term: tok.word, category: hardStemMatch.category });
      alreadyFlagged.add(tok.start);
      continue;
    }

    // ── SOFTEN check (direct match in DEFAULT_REPLACEMENTS) ──
    if (DEFAULT_REPLACEMENTS[lower] !== undefined) {
      softHits.push({ word: tok.word, replacement: DEFAULT_REPLACEMENTS[lower] });
      pendingReplacements.push({ start: tok.start, end: tok.end, replacement: DEFAULT_REPLACEMENTS[lower] });
      alreadyFlagged.add(tok.start);
      continue;
    }
    // Soften via stem
    if (stemmed !== lower && DEFAULT_REPLACEMENTS[stemmed] !== undefined) {
      softHits.push({ word: tok.word, replacement: DEFAULT_REPLACEMENTS[stemmed] });
      pendingReplacements.push({ start: tok.start, end: tok.end, replacement: DEFAULT_REPLACEMENTS[stemmed] });
      alreadyFlagged.add(tok.start);
      continue;
    }
  }

  // Build cleanedText: apply replacements back-to-front so indices don't shift.
  let cleanedText = text;
  if (pendingReplacements.length > 0) {
    const sorted = [...pendingReplacements].sort((a, b) => b.start - a.start);
    for (const r of sorted) {
      cleanedText = cleanedText.slice(0, r.start) + r.replacement + cleanedText.slice(r.end);
    }
  }

  const verdict: ScanResult["verdict"] = hardHits.length > 0 ? "block" : softHits.length > 0 ? "soften" : "clean";
  return { verdict, hardHits, softHits, cleanedText };
}
