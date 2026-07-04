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
