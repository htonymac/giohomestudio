// Unit test for src/lib/children/multiTopic.ts — run: npx tsx tests/test-multi-topic.mts
// Fixture 1 is Henry's VERBATIM 2026-07-03 brief, typos included.
import { parseMultiTopicInstruction } from "../src/lib/children/multiTopic";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ok — ${label}`);
  else {
    failures++;
    console.error(`  FAIL — ${label}`);
  }
}

// ── Fixture 1: Henry's real brief, verbatim (typos: WOR, APHABET, EDUCTATION, STORE) ──
const henryBrief = `4 TOPIC  - 60 MIN - SPELLING 2 TO 5 LETTER WOR 20 MIN -  APHABET WITH IMAGE 10 MIN  ---PLAY EDUCTATION WITH TEACH TEACHING SCHOOL STUDENT 15 MIN -- BED TIME STORE  3 STORES TELL MINUNE ALL EACH SEARCH ONE SCENE DEMACATE SCENE BY SCENE - SHOULD BE EXTREMELY MEANING FUL  - MANY ACTION VERB THIS IS ANDIO HYBRID- ALL IMAGES NO VIDEO SO EACH IMAGE SHOULD REPRESENT SCENE CAN BE AS LONG AS U MAYBE WANT IT`;

console.log("Fixture 1: Henry's verbatim brief");
const plan = parseMultiTopicInstruction(henryBrief);
assert(plan !== null, "detected as multi-topic");
if (plan) {
  assert(plan.totalSeconds === 3600, `total 60 min (got ${plan.totalSeconds}s)`);
  const kinds = plan.segments.map(s => s.kind);
  assert(kinds.includes("spelling"), `spelling segment found (kinds: ${kinds.join(",")})`);
  assert(kinds.includes("abc"), "abc segment found despite APHABET typo");
  assert(kinds.includes("play"), "play segment found despite EDUCTATION typo");
  assert(kinds.includes("story"), "bedtime story segment found despite STORE typo");
  const spelling = plan.segments.find(s => s.kind === "spelling")!;
  assert(spelling.targetSeconds === 1200, `spelling 20 min (got ${spelling.targetSeconds}s)`);
  assert(spelling.wordLengthMin === 2 && spelling.wordLengthMax === 5, "spelling 2-5 letter range");
  const abc = plan.segments.find(s => s.kind === "abc")!;
  assert(abc.targetSeconds === 600, `abc 10 min (got ${abc.targetSeconds}s)`);
  const play = plan.segments.find(s => s.kind === "play")!;
  assert(play.targetSeconds === 900, `play 15 min (got ${play.targetSeconds}s)`);
  const story = plan.segments.find(s => s.kind === "story")!;
  assert(story.storyCount === 3, `3 stories (got ${story.storyCount})`);
  assert(story.targetSeconds === 900, `stories get the 15-min remainder (got ${story.targetSeconds}s)`);
}

// ── Fixture 1b: exact segment count + ORDER locked for the Henry brief ──
console.log("Fixture 1b: segment count + ordering");
if (plan) {
  assert(plan.segments.length === 4, `exactly 4 segments (got ${plan.segments.length})`);
  assert(
    plan.segments.map(s => s.kind).join(">") === "spelling>abc>play>story",
    `order preserved as authored (got ${plan.segments.map(s => s.kind).join(">")})`
  );
}

// ── Fixture 1c: two-topic brief with NO meta header must parse (Sourcery) ──
console.log("Fixture 1c: two topics, no meta header");
const twoTopic = parseMultiTopicInstruction("spelling 3 letter words 10 min - bedtime story 10 min");
assert(twoTopic !== null, "2-topic no-meta brief detected");
if (twoTopic) {
  assert(twoTopic.segments.length === 2, `2 segments (got ${twoTopic.segments.length})`);
  assert(twoTopic.totalSeconds === 1200, `total 20 min from sum (got ${twoTopic.totalSeconds}s)`);
}

// ── Fixture 1d: hours + over-assigned durations ──
console.log("Fixture 1d: hours + over-assigned");
const hourBrief = parseMultiTopicInstruction("1 hour - counting 40 min - alphabet 30 min");
assert(hourBrief !== null, "hour total detected");
if (hourBrief) {
  // Assigned (70 min) exceeds explicit total (60) → total = max(explicit, sum) = 4200s.
  assert(hourBrief.totalSeconds === 4200, `over-assigned takes the sum (got ${hourBrief.totalSeconds}s)`);
}

// ── Fixture 5: Henry's 2026-07-04 SCENE OUTLINE (verbatim) — must become a
// segmented plan, NOT be echoed verbatim by the authored-script path ──
const henryOutline = `I need a 60 minute video with 6 scene of different subject and title for children of 4 to 7 years.
scene 1: 4,5,6 letters words
scene 2: story about a man on a long journey to  letter A to Z where each town he found  4 and 5 letter words for each letters
scene 3: math
scene 4: science
scene 5: how machine works
scene 6: why we need a doctor and 2 bed time story`;

console.log("Fixture 5: Henry's scene outline (2026-07-04)");
const outlinePlan = parseMultiTopicInstruction(henryOutline);
assert(outlinePlan !== null, "outline detected as multi-topic plan");
if (outlinePlan) {
  assert(outlinePlan.totalSeconds === 3600, `total 60 min from preamble (got ${outlinePlan.totalSeconds}s)`);
  // scene 6 splits into doctor-lesson + 2 stories → 7 segments
  assert(outlinePlan.segments.length === 7, `7 segments incl. scene-6 split (got ${outlinePlan.segments.length})`);
  const kinds = outlinePlan.segments.map(s => s.kind);
  assert(kinds[0] === "spelling", `scene 1 → spelling (got ${kinds[0]})`);
  const sp = outlinePlan.segments[0];
  assert(sp.wordLengthMin === 4 && sp.wordLengthMax === 6, `"4,5,6 letters words" → lengths 4-6 (got ${sp.wordLengthMin}-${sp.wordLengthMax})`);
  assert(kinds[1] === "story", `scene 2 → story (got ${kinds[1]})`);
  assert(
    outlinePlan.segments[1].label.includes("long journey"),
    "scene 2 keeps the user's own story subject"
  );
  assert(kinds[2] === "counting", `scene 3 math → counting (got ${kinds[2]})`);
  assert(kinds[3] === "play" && kinds[4] === "play", `science + machines → LLM lessons (got ${kinds[3]},${kinds[4]})`);
  assert(kinds[5] === "play", `scene 6 doctor part → lesson (got ${kinds[5]})`);
  const bed = outlinePlan.segments[6];
  assert(bed.kind === "story" && bed.storyCount === 2, `scene 6 story part → 2 stories (got ${bed.kind}/${bed.storyCount})`);
  // each of the 6 scenes shares the hour; scene 6's share is halved across its split
  const evenish = outlinePlan.segments.every(s => s.targetSeconds >= 250 && s.targetSeconds <= 700);
  assert(evenish, `segments share the hour sensibly (got ${outlinePlan.segments.map(s => s.targetSeconds).join(",")})`);
}

// ── Fixture 5b: word-length forms + storyCount clamp + compound edge (Sourcery) ──
console.log("Fixture 5b: word-length forms + clamps");
const rangeForm = parseMultiTopicInstruction(`20 min
scene 1: spelling 2 to 5 letter words
scene 2: bedtime story`);
assert(rangeForm !== null, "range-form outline parses");
if (rangeForm) {
  const sp = rangeForm.segments.find(s => s.kind === "spelling")!;
  assert(sp.wordLengthMin === 2 && sp.wordLengthMax === 5, `range '2 to 5 letter' → 2-5 (got ${sp.wordLengthMin}-${sp.wordLengthMax})`);
}
const singleForm = parseMultiTopicInstruction(`20 min
scene 1: 3 letter words spelling
scene 2: counting`);
if (singleForm) {
  const sp = singleForm.segments.find(s => s.kind === "spelling")!;
  assert(sp.wordLengthMin === 3 && sp.wordLengthMax === 3, `single '3 letter' → 3-3 (got ${sp.wordLengthMin}-${sp.wordLengthMax})`);
}
const clampForm = parseMultiTopicInstruction(`30 min
scene 1: counting
scene 2: 99 bed time stories`);
if (clampForm) {
  const st = clampForm.segments.find(s => s.kind === "story")!;
  assert(st.storyCount === 10, `storyCount clamps at 10 (got ${st.storyCount})`);
}
// Compound guard: a scene that is ONLY stories must NOT split a lesson out.
const pureStories = parseMultiTopicInstruction(`30 min
scene 1: math
scene 2: stories for bedtime 3 stories`);
if (pureStories) {
  assert(
    pureStories.segments.filter(s => s.kind === "story").length === 1 && pureStories.segments.length === 2,
    `story-only scene stays one segment (got ${pureStories.segments.map(s => s.kind).join(",")})`
  );
}

// ── Fixture 2: single-topic prompt must NOT be multi-topic ──
console.log("Fixture 2: single topic guard");
assert(
  parseMultiTopicInstruction("A gentle bedtime story about a brave little ant, 5 minutes") === null,
  "single story prompt → null (falls through to normal path)"
);

// ── Fixture 3: plain story idea with no durations must NOT be multi-topic ──
console.log("Fixture 3: no-duration guard");
assert(
  parseMultiTopicInstruction("A story about counting stars and spelling games with friends at school") === null,
  "no duration signal → null"
);

// ── Fixture 4: newline-separated list with total only ──
const newlineBrief = `30 min
spelling 3 letter words 10 min
counting to twenty
bedtime story about the moon`;
console.log("Fixture 4: newline list, remainder split");
const p4 = parseMultiTopicInstruction(newlineBrief);
assert(p4 !== null, "newline list detected");
if (p4) {
  assert(p4.totalSeconds === 1800, `total 30 min (got ${p4.totalSeconds}s)`);
  const noDur = p4.segments.filter(s => ["counting", "story"].includes(s.kind));
  assert(
    noDur.length === 2 && noDur.every(s => s.targetSeconds === 600),
    `counting + story split the 20-min remainder 10/10 (got ${noDur.map(s => s.targetSeconds).join("/")})`
  );
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
