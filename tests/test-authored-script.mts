// Unit test for src/lib/story/authoredScript.ts — run: npx tsx tests/test-authored-script.mts
// Fixture mirrors Henry's real ChatGPT paste (2026-07-03): 18 scenes,
// "**Scene N — Title, X–Y Minutes:**" headers with EN-DASH ranges, body on
// the same line after the colon.
import {
  detectAuthoredScript,
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
Two friends meet at the market and greet each other warmly.

SCENE 2: The Chase
The thief grabs the basket and runs; Ade sprints after him through the stalls.

Scene 3 - The Lesson (4-6 minutes)
The elder explains why honesty matters while the children listen.`;

console.log("Fixture 2: plain headers");
assert(detectAuthoredScript(plainScript), "plain format detected");
const p2 = parseAuthoredScript(plainScript);
assert(p2.scenes.length === 3, `3 scenes (got ${p2.scenes.length})`);
assert(p2.scenes[0].durationSeconds === 120, `hyphen range 0-2 min = 120s (got ${p2.scenes[0].durationSeconds})`);
assert(
  p2.scenes[1].durationSeconds === estimateSceneSeconds(p2.scenes[1].text),
  "scene without range falls back to narration estimate"
);
assert(p2.scenes[1].text.includes("thief grabs the basket"), "multi-line body captured");

// ── Fixture 3: prose that merely MENTIONS scenes must NOT be detected ──
const prose = `The little star loved the night sky. In one memorable scene 3 birds flew past her, and later the moon rose slowly over the hills. The story ends with everyone asleep and the village quiet under the stars, dreaming of tomorrow.`;
console.log("Fixture 3: prose false-positive guard");
assert(!detectAuthoredScript(prose), "plain prose NOT detected as script");

// ── Fixture 4: short instruction (Henry's original brief) NOT a script ──
const brief = `4 TOPIC - 60 MIN - SPELLING 2 TO 5 LETTER WORDS 20 MIN - ALPHABET WITH IMAGE 10 MIN - PLAY EDUCATION 15 MIN - BEDTIME STORIES 3 STORIES`;
console.log("Fixture 4: instruction brief guard");
assert(!detectAuthoredScript(brief), "topic instruction NOT detected as script");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
