// Unit test for src/lib/story/authoredScript.ts — run: npx tsx tests/test-authored-script.mts
// Fixture mirrors Henry's real ChatGPT paste (2026-07-03): 18 scenes,
// "**Scene N — Title, X–Y Minutes:**" headers with EN-DASH ranges, body on
// the same line after the colon.
import {
  detectAuthoredScript,
  detectSceneOutline,
  parseAuthoredScript,
  estimateSceneSeconds,
} from "../src/lib/story/authoredScript";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ok — ${label}`);
  else {
    failures++;
    console.error(`  FAIL — ${label}`);
  }
}

// ── Fixture 1: Henry's format (abridged to 5 scenes incl. the last one) ──
const henryScript = `**ANDIO HYBRID KIDS EDUCATION SHOW — 60 MINUTES — IMAGE-ONLY SCENE SCRIPT**

**Scene 1 — Spelling Warm-Up, 0–4 Minutes:** Create one bright classroom image where a smiling teacher stands beside a large colorful board that says "Today We Spell Small Words," while happy school children sit on a soft mat, raise their hands, clap, point, smile, listen, and look excited.

**Scene 2 — Spelling 2-Letter Words, 4–8 Minutes:** Create one image of the teacher holding flashcards with big bold letters while the children stand in a circle and actively pick, match, touch, arrange, and read 2-letter words.

**Scene 3 — Spelling 3-Letter Words, 8–12 Minutes:** Create one image showing children building 3-letter words with alphabet blocks on a table, while the teacher guides them gently.

**Scene 17 — Bedtime Story 2, The Brave Ant and the Heavy Grain, 50–55 Minutes:** Create one peaceful moonlit garden image where a small ant struggles to carry a heavy grain of rice.

**Scene 18 — Bedtime Story 3, The Lost Toy and the Kind Child, 55–60 Minutes:** Create one soft bedtime room image where a child finds a lost teddy bear under a chair, picks it up gently, cleans it, hugs it, and returns it to a younger sibling.`;

console.log("Fixture 1: Henry's ChatGPT script");
assert(detectAuthoredScript(henryScript), "detected as authored script");
const parsed = parseAuthoredScript(henryScript);
assert(parsed.scenes.length === 5, `5 scenes parsed (got ${parsed.scenes.length})`);
assert(parsed.scenes[0].index === 1 && parsed.scenes[4].index === 18, "scene numbers preserved");
assert(parsed.scenes[0].title === "Spelling Warm-Up", `title 1 clean (got "${parsed.scenes[0].title}")`);
assert(
  parsed.scenes[0].durationSeconds === 240,
  `scene 1 = 240s from 0–4 min en-dash range (got ${parsed.scenes[0].durationSeconds})`
);
assert(
  parsed.scenes[4].startSeconds === 3300 && parsed.scenes[4].endSeconds === 3600,
  "scene 18 range 55–60 min → 3300–3600s"
);
assert(parsed.totalSeconds === 3600, `total = 3600s / 60 min (got ${parsed.totalSeconds})`);
assert(
  parsed.scenes[0].text.startsWith("Create one bright classroom image"),
  "same-line body after colon preserved verbatim"
);
assert(!parsed.scenes[0].text.includes("**Scene"), "no header bleed into body");
assert(
  parsed.scenes[3].title.includes("Brave Ant"),
  `comma-titled scene keeps full title (got "${parsed.scenes[3].title}")`
);

// ── Fixture 2: plain unformatted headers, ASCII hyphen, mixed case ──
const plainScript = `scene 1 - The Meeting (0-2 minutes)
Two friends meet at the busy market in the warm morning light and greet each other with wide smiles, clasping hands under the colorful stalls.

SCENE 2: The Chase
The thief grabs the basket of fruit and runs; Ade sprints after him through the crowded stalls, leaping over crates while traders shout and point the way.

Scene 3 - The Lesson (4-6 minutes)
The elder sits the children down in the shade and explains gently why honesty matters, while Ade returns the basket and everyone claps for him.`;

console.log("Fixture 2: plain headers");
assert(detectAuthoredScript(plainScript), "plain format detected");
const p2 = parseAuthoredScript(plainScript);
assert(p2.scenes.length === 3, `3 scenes (got ${p2.scenes.length})`);
assert(p2.scenes[0].durationSeconds === 120, `hyphen range 0-2 min = 120s (got ${p2.scenes[0].durationSeconds})`);
assert(p2.scenes[0].title === "The Meeting", `parenthesized time range leaves no empty "()" (got "${p2.scenes[0].title}")`);
assert(
  p2.scenes[1].durationSeconds === estimateSceneSeconds(p2.scenes[1].text),
  "scene without range falls back to narration estimate"
);
assert(p2.scenes[1].text.includes("thief grabs the basket"), "multi-line body captured");

// ── Fixture 3: prose that merely MENTIONS scenes must NOT be detected ──
const prose = `The little star loved the night sky. In one memorable scene 3 birds flew past her, and later the moon rose slowly over the hills. The story ends with everyone asleep and the village quiet under the stars, dreaming of tomorrow.`;
console.log("Fixture 3: prose false-positive guard");
assert(!detectAuthoredScript(prose), "plain prose NOT detected as script");

// ── Fixture 3b: non-ascending / noisy scene numbering must NOT be detected ──
// Exercises the ascending-numbering heuristic directly: line-start "scene N"
// mentions in random order are prose references, not an authored script.
const noisyNumbers = `My notes on the edit so far.
Scene 7 felt too slow when we watched it back yesterday evening.
Scene 2 needs new music because the old track was CC-BY licensed.
Scene 5 has the wrong caption font and needs the arial fix applied.
Scene 1 is fine as shipped.`;
console.log("Fixture 3b: noisy non-ascending numbering guard");
assert(!detectAuthoredScript(noisyNumbers), "non-ascending scene mentions NOT detected as script");

// Boundary: mostly-ascending WITH one out-of-order header still detects
// (authors sometimes renumber a single inserted scene).
const oneSwap = `Scene 1: The dawn breaks over the quiet village as farmers wake, stretch, and carry their hoes toward the green fields beyond the river.
Scene 2: The market fills with traders shouting their morning prices while children weave between the stalls carrying baskets of bright fruit.
Scene 4: The storm arrives with a roar and everyone runs for shelter, pulling tarpaulins over the goods as rain hammers the tin roofs.
Scene 3: A child loses her basket in the crowded square and a kind stranger kneels to help her gather the scattered oranges.
Scene 5: The rainbow appears over the wet rooftops and calm returns to the village as neighbors laugh and reopen their stalls.`;
console.log("Fixture 3c: single out-of-order header tolerated");
assert(detectAuthoredScript(oneSwap), "mostly-ascending script with one swap still detected");

// ── Fixture 4: short instruction (Henry's original brief) NOT a script ──
const brief = `4 TOPIC - 60 MIN - SPELLING 2 TO 5 LETTER WORDS 20 MIN - ALPHABET WITH IMAGE 10 MIN - PLAY EDUCATION 15 MIN - BEDTIME STORIES 3 STORIES`;
console.log("Fixture 4: instruction brief guard");
assert(!detectAuthoredScript(brief), "topic instruction NOT detected as script");

// ── Fixture 5: scene OUTLINE (short topic labels) must NOT be a script ──
// Henry 2026-07-04: "scene 1: 4,5,6 letters words / scene 3: math" got used
// verbatim as scene content. Outlines need generation, not verbatim use.
const outline = `I need a 60 minute video with 6 scene of different subject and title for children of 4 to 7 years.
scene 1: 4,5,6 letters words
scene 2: story about a man on a long journey to letter A to Z where each town he found 4 and 5 letter words for each letters
scene 3: math
scene 4: science
scene 5: how machine works
scene 6: why we need a doctor and 2 bed time story`;
console.log("Fixture 5: outline vs script discrimination");
assert(!detectAuthoredScript(outline), "scene OUTLINE not detected as authored script");
assert(detectSceneOutline(outline), "scene OUTLINE detected by detectSceneOutline");
assert(!detectSceneOutline(henryScript), "real script NOT flagged as outline");
assert(detectAuthoredScript(henryScript), "real script still detected as authored (regression)");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
