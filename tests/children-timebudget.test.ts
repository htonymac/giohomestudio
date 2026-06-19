// Unit tests for the children time-budget engine. Run: npx tsx tests/children-timebudget.test.ts
// Asserts the core invariant: sum(item.onScreenSeconds) === targetSeconds, exactly,
// across every age/mode/target, with and without Max images.

import { buildTimePlan } from "../src/lib/children/timeBudget";
import { parseDurationToSeconds } from "../src/lib/children/duration";
import type { Age, ChildMode } from "../src/lib/children/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; } else { fail++; console.log(`FAIL ${name} ${detail}`); }
}
function approx(a: number, b: number, eps = 0.05) { return Math.abs(a - b) <= eps; }

const ages: Age[] = ["toddler", "preschool", "early", "older"];
const modes: ChildMode[] = ["spelling", "abc", "counting", "story", "poem"];
const targets = [60, 300, 600, 3600];

// 1) sum-of-onScreen === target for every combination
for (const age of ages) {
  for (const mode of modes) {
    for (const target of targets) {
      for (const wordLength of [2, 4, 7, 10]) {
        const plan = buildTimePlan({ targetSeconds: target, age, mode, wordLength });
        const sum = plan.items.reduce((s, it) => s + it.onScreenSeconds, 0);
        check(`sum==target ${age}/${mode}/${target}/len${wordLength}`, approx(sum, target),
          `got ${sum.toFixed(2)} want ${target}`);
        check(`itemCount matches ${age}/${mode}/${target}`, plan.items.length === plan.itemCount);
        check(`all items positive ${age}/${mode}/${target}`, plan.items.every(it => it.onScreenSeconds > 0));
      }
    }
  }
}

// 2) Max images: imagesPerItem >= 1, slot seconds sum to the item hold
{
  const plan = buildTimePlan({ targetSeconds: 300, age: "preschool", mode: "spelling", wordLength: 4, maxImages: true, secondsPerImage: 4 });
  const sum = plan.items.reduce((s, it) => s + it.onScreenSeconds, 0);
  check("maxImages sum==target", approx(sum, 300), `got ${sum}`);
  check("maxImages >=1 per item", plan.items.every(it => it.imagesPerItem >= 1));
  check("maxImages slot*count≈hold", plan.items.every(it => approx(it.secondsPerImage * it.imagesPerItem, it.onScreenSeconds, 0.06)));
}

// 3) default (no Max) = exactly 1 image per item
{
  const plan = buildTimePlan({ targetSeconds: 60, age: "toddler", mode: "spelling", wordLength: 3 });
  check("default 1 image/item", plan.items.every(it => it.imagesPerItem === 1));
}

// 4) sectioning kicks in at >=600s only
{
  check("not sectioned at 300", buildTimePlan({ targetSeconds: 300, age: "early", mode: "spelling", wordLength: 4 }).sectioned === false);
  check("sectioned at 600", buildTimePlan({ targetSeconds: 600, age: "early", mode: "spelling", wordLength: 4 }).sectioned === true);
  check("sectioned at 3600", buildTimePlan({ targetSeconds: 3600, age: "older", mode: "spelling", wordLength: 6 }).sectioned === true);
}

// 5) narration strategy: teaching = per-item-tts, narrative = single-pass
{
  check("spelling->per-item-tts", buildTimePlan({ targetSeconds: 120, age: "early", mode: "spelling", wordLength: 4 }).narrationStrategy === "per-item-tts");
  check("story->single-pass", buildTimePlan({ targetSeconds: 120, age: "early", mode: "story" }).narrationStrategy === "single-pass");
}

// 6) longer words -> fewer items (more time per word) at the same target
{
  const short = buildTimePlan({ targetSeconds: 300, age: "older", mode: "spelling", wordLength: 2 }).itemCount;
  const long = buildTimePlan({ targetSeconds: 300, age: "older", mode: "spelling", wordLength: 10 }).itemCount;
  check("longer words -> fewer items", long < short, `len2=${short} len10=${long}`);
}

// 7) duration parser
{
  check("parse 300", parseDurationToSeconds("300") === 300);
  check("parse 60 sec", parseDurationToSeconds("60 sec") === 60);
  check("parse 5 min", parseDurationToSeconds("5 min") === 300);
  check("parse 1 hour", parseDurationToSeconds("1 hour") === 3600);
  check("parse 1 hr", parseDurationToSeconds("1 hr") === 3600);
  check("parse 2 hrs", parseDurationToSeconds("2 hrs") === 7200);
  check("parse 2.5 min", parseDurationToSeconds("2.5 min") === 150);
  check("parse number 600", parseDurationToSeconds(600) === 600);
  check("parse number 0 -> fallback", parseDurationToSeconds(0) === 60);
  check("parse negative -> fallback", parseDurationToSeconds(-5) === 60);
  check("parse NaN -> fallback", parseDurationToSeconds(NaN) === 60);
  check("parse junk->fallback", parseDurationToSeconds("abc") === 60);
  check("parse empty->fallback", parseDurationToSeconds("") === 60);
}

console.log(`\n${fail === 0 ? "ALL PASSED" : "SOME FAILED"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
