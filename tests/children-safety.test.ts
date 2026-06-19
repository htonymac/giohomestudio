// tests/children-safety.test.ts
// Unit tests for src/lib/children/safetyScanner.ts
// Run: npx tsx tests/children-safety.test.ts

import { scanText } from "../src/lib/children/safetyScanner";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; } else { fail++; console.log(`FAIL  ${name}  ${detail}`); }
}

// ── 1) SAFE-WORD ALLOWLIST — must all be CLEAN ────────────────────────────
{
  const safeWords = [
    "grass",
    "class",
    "classroom",
    "assignment",
    "cassette",
    "assassin",
    "assist",
    "assembly",
    "skills",
    "skilled",
    "glass",
    "brass",
  ];
  for (const word of safeWords) {
    const r = scanText(`The ${word} is here`);
    check(`safe word "${word}" → clean`, r.verdict === "clean",
      `verdict=${r.verdict} hardHits=${JSON.stringify(r.hardHits)} softHits=${JSON.stringify(r.softHits)}`);
  }
}

// ── 2) SOFT HIT — stemmer triggers replacement on inflected forms ─────────
{
  // "killing" → stem → "kill" → DEFAULT_REPLACEMENTS["kill"] = "stop"
  const r = scanText("He was killing the dragon");
  check("killing → soften", r.verdict === "soften",
    `verdict=${r.verdict}`);
  check("killing → cleanedText contains replacement", r.cleanedText.toLowerCase().includes("stop"),
    `cleaned="${r.cleanedText}"`);
  check("killing → softHit word=killing", r.softHits.some(h => h.word.toLowerCase() === "killing"),
    `softHits=${JSON.stringify(r.softHits)}`);
}

{
  // Direct match: "blood" → "paint"
  const r = scanText("There was blood on the floor");
  check("blood → soften", r.verdict === "soften", `verdict=${r.verdict}`);
  check("blood → cleaned contains paint", r.cleanedText.toLowerCase().includes("paint"),
    `cleaned="${r.cleanedText}"`);
}

{
  // Inflected match: "fighting" → stem "fight" → "play-tussle" … but "fighting"
  // is directly in DEFAULT_REPLACEMENTS as "play-tussling"
  const r = scanText("They are fighting in the yard");
  check("fighting → soften", r.verdict === "soften", `verdict=${r.verdict}`);
}

// ── 3) HARD BLOCK — explicit violence terms ───────────────────────────────
{
  const r = scanText("The torture chamber was horrifying");
  check("torture → block", r.verdict === "block",
    `verdict=${r.verdict}`);
  check("torture → category=graphicViolence", r.hardHits.some(h => h.category === "graphicViolence"),
    `hardHits=${JSON.stringify(r.hardHits)}`);
}

{
  const r = scanText("The scene had gore everywhere");
  check("gore → block", r.verdict === "block", `verdict=${r.verdict}`);
}

// ── 4) HARD BLOCK — sexual terms ─────────────────────────────────────────
{
  const r = scanText("There was pornography displayed");
  check("pornography → block", r.verdict === "block", `verdict=${r.verdict}`);
  check("pornography → category=sexual", r.hardHits.some(h => h.category === "sexual"),
    `hardHits=${JSON.stringify(r.hardHits)}`);
}

{
  // "rape" appears in "grape" — must NOT trigger (token-only matching)
  const r = scanText("She ate a bunch of grapes");
  check("grapes does NOT trigger rape block", r.verdict === "clean",
    `verdict=${r.verdict} hardHits=${JSON.stringify(r.hardHits)}`);
}

// ── 5) HARD BLOCK — self-harm ─────────────────────────────────────────────
{
  const r = scanText("The story mentions suicide");
  check("suicide → block", r.verdict === "block", `verdict=${r.verdict}`);
  check("suicide → category=selfHarm", r.hardHits.some(h => h.category === "selfHarm"),
    `hardHits=${JSON.stringify(r.hardHits)}`);
}

// ── 6) HARD BLOCK — hard drugs ───────────────────────────────────────────
{
  const r = scanText("He bought cocaine from the dealer");
  check("cocaine → block", r.verdict === "block", `verdict=${r.verdict}`);
  check("cocaine → category=hardDrugs", r.hardHits.some(h => h.category === "hardDrugs"),
    `hardHits=${JSON.stringify(r.hardHits)}`);
}

// ── 6b) Sourcery fix — MULTI-WORD hard-block phrases must match ───────────
{
  for (const phrase of ["I want to kill myself", "she might cut myself", "this is about self harm"]) {
    const r = scanText(phrase);
    check(`multi-word "${phrase}" → block`, r.verdict === "block", `verdict=${r.verdict} hits=${JSON.stringify(r.hardHits)}`);
  }
}

// ── 6c) Sourcery fix — "shoot" softens (not allowlisted) ──────────────────
{
  const r = scanText("They shoot the bad guy");
  check("shoot → soften (not clean)", r.verdict === "soften", `verdict=${r.verdict}`);
  check("shoot → replaced (zap)", /zap/i.test(r.cleanedText), `cleaned=${r.cleanedText}`);
}

{
  // "drug" → SOFTEN (in DEFAULT_REPLACEMENTS) NOT block
  const r = scanText("He took a drug");
  check("drug (generic) → soften not block", r.verdict === "soften",
    `verdict=${r.verdict}`);
}

// ── 7) CLEAN — ordinary children text ────────────────────────────────────
{
  const cleanTexts = [
    "The bunny jumped over the log",
    "She found a shiny red apple",
    "Count the stars in the sky",
    "The letters A B C dance around",
  ];
  for (const t of cleanTexts) {
    const r = scanText(t);
    check(`"${t.slice(0, 40)}" → clean`, r.verdict === "clean",
      `verdict=${r.verdict} soft=${JSON.stringify(r.softHits)} hard=${JSON.stringify(r.hardHits)}`);
  }
}

// ── 8) MIXED: soften + no block ──────────────────────────────────────────
{
  const r = scanText("The monster was evil but he had a gun");
  check("mixed soften text → soften not block", r.verdict === "soften",
    `verdict=${r.verdict}`);
  // monster, evil, gun should all be in softHits
  const softWords = r.softHits.map(h => h.word.toLowerCase());
  check("monster → softHit", softWords.includes("monster"), `softHits=${JSON.stringify(r.softHits)}`);
  check("evil → softHit", softWords.includes("evil"), `softHits=${JSON.stringify(r.softHits)}`);
  check("gun → softHit", softWords.includes("gun"), `softHits=${JSON.stringify(r.softHits)}`);
}

// ── 9) cleanedText correctness ─────────────────────────────────────────────
{
  const r = scanText("The sword and the gun lay there");
  check("sword → wand in cleanedText", r.cleanedText.toLowerCase().includes("wand"),
    `cleaned="${r.cleanedText}"`);
  check("gun → toy in cleanedText", r.cleanedText.toLowerCase().includes("toy"),
    `cleaned="${r.cleanedText}"`);
  // originals should be gone
  check("sword removed from cleanedText", !r.cleanedText.toLowerCase().includes("sword"),
    `cleaned="${r.cleanedText}"`);
}

// ── 10) empty / whitespace → clean ───────────────────────────────────────
{
  const r1 = scanText("");
  check("empty string → clean", r1.verdict === "clean");
  const r2 = scanText("   ");
  check("whitespace → clean", r2.verdict === "clean");
}

// ── 11) block beats soften when both present ──────────────────────────────
{
  const r = scanText("There was gore and fighting");
  check("gore+fighting → block wins", r.verdict === "block",
    `verdict=${r.verdict}`);
}

// ── 12) slur detection ────────────────────────────────────────────────────
{
  const r = scanText("He called him a retard");
  check("retard → block", r.verdict === "block", `verdict=${r.verdict}`);
  check("retard → category=slurs", r.hardHits.some(h => h.category === "slurs"),
    `hardHits=${JSON.stringify(r.hardHits)}`);
}

console.log(`\n${fail === 0 ? "ALL PASSED" : "SOME FAILED"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
