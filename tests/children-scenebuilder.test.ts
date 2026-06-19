// Proves the deterministic builder makes content scale with time — the fix for
// "60s and 600s videos look the same". Run: npx tsx tests/children-scenebuilder.test.ts
import { buildChildScenes, resolveChildMode } from "../src/lib/children/buildChildScenes";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); }
}
function approx(a: number, b: number, e = 0.05) { return Math.abs(a - b) <= e; }

// 1) THE core fix: 600s produces far more items than 60s (counting + spelling)
for (const mode of ["counting", "spelling"] as const) {
  const short = buildChildScenes({ mode, age: "preschool", targetSeconds: 60, wordLength: 4, seed: 1 });
  const long = buildChildScenes({ mode, age: "preschool", targetSeconds: 600, wordLength: 4, seed: 1 });
  check(`${mode}: 600s has many more items than 60s`, long.itemCount >= short.itemCount * 6,
    `60s=${short.itemCount} 600s=${long.itemCount}`);
  check(`${mode}: 60s sum==target`, approx(short.totalSeconds, 60), `${short.totalSeconds}`);
  check(`${mode}: 600s sum==target`, approx(long.totalSeconds, 600), `${long.totalSeconds}`);
}

// 2) counting actually counts higher / more rounds at 600s
{
  const long = buildChildScenes({ mode: "counting", age: "preschool", targetSeconds: 600, wordLength: 3, seed: 1 });
  const maxNumberShown = Math.max(...long.scenes.map(s => Number(s.overlayText)));
  const distinctImageSets = new Set(long.scenes.map(s => s.imageNoun.replace(/^\d+\s/, ""))).size;
  check("counting 600s reaches the per-age max (10)", maxNumberShown === 10, `max=${maxNumberShown}`);
  check("counting 600s uses multiple object rounds", distinctImageSets >= 3, `sets=${distinctImageSets}`);
  check("counting overlay is the number", long.scenes.every(s => /^\d+$/.test(s.overlayText)));
}

// 3) spelling: one word per scene, perfect overlay, narration spells it
{
  const sp = buildChildScenes({ mode: "spelling", age: "early", targetSeconds: 120, wordLength: 4, seed: 7 });
  check("spelling overlay = a real word", sp.scenes.every(s => /^[a-z-]+$/i.test(s.overlayText)));
  check("spelling narration contains spelled-out letters", sp.scenes.every(s => s.narration.includes(" — ")));
  check("spelling flashcardLetter = first letter", sp.scenes.every(s => s.flashcardLetter === s.overlayText[0].toUpperCase()));
}

// 4) abc is always 26 letters regardless of duration; each holds target/26
{
  const a1 = buildChildScenes({ mode: "abc", age: "toddler", targetSeconds: 60, seed: 1 });
  const a2 = buildChildScenes({ mode: "abc", age: "toddler", targetSeconds: 600, seed: 1 });
  check("abc always 26 items", a1.itemCount === 26 && a2.itemCount === 26);
  check("abc 60s sum==target", approx(a1.totalSeconds, 60));
  check("abc 600s sum==target", approx(a2.totalSeconds, 600));
  check("abc 600s holds longer per letter", a2.scenes[0].onScreenSeconds > a1.scenes[0].onScreenSeconds);
  check("abc first letter is A is for Apple", a1.scenes[0].flashcardLetter === "A" && a1.scenes[0].overlayText === "Apple");
}

// 5) maxImages: same item -> N images, slot seconds sum to the item hold, total still target
{
  const m = buildChildScenes({ mode: "spelling", age: "preschool", targetSeconds: 120, wordLength: 4, seed: 3, maxImages: true, secondsPerImage: 4 });
  check("maxImages >=1 per item", m.scenes.every(s => s.imagesPerItem >= 1));
  check("maxImages total==target", approx(m.totalSeconds, 120), `${m.totalSeconds}`);
}

// 6) variety: different seeds -> different word order (same selection differs per run)
{
  const a = buildChildScenes({ mode: "spelling", age: "preschool", targetSeconds: 120, wordLength: 4, seed: 111 });
  const b = buildChildScenes({ mode: "spelling", age: "preschool", targetSeconds: 120, wordLength: 4, seed: 222 });
  check("different seeds -> different content", a.scenes.map(s => s.overlayText).join() !== b.scenes.map(s => s.overlayText).join());
}

// 7) story/poem are NOT handled here (stay on LLM)
{
  const st = buildChildScenes({ mode: "story", age: "early", targetSeconds: 120, seed: 1 });
  check("story returns no deterministic scenes", st.scenes.length === 0);
}

// 8) CONCEPT mode (colours/shapes/animals/feelings/...) — ALL content types scale by time
{
  const types = ["colours-shapes", "animals-nature", "feelings-faces", "my-world", "first-words", "music-movement"];
  for (const ct of types) {
    const short = buildChildScenes({ mode: "concept", age: "toddler", targetSeconds: 60, contentTypeId: ct, seed: 1 });
    const long = buildChildScenes({ mode: "concept", age: "toddler", targetSeconds: 600, contentTypeId: ct, seed: 1 });
    check(`concept ${ct}: builds scenes`, short.scenes.length > 0, `${short.scenes.length}`);
    check(`concept ${ct}: 600s >> 60s`, long.itemCount >= short.itemCount * 6, `60s=${short.itemCount} 600s=${long.itemCount}`);
    check(`concept ${ct}: 60s sum==target`, approx(short.totalSeconds, 60), `${short.totalSeconds}`);
    check(`concept ${ct}: 600s sum==target`, approx(long.totalSeconds, 600), `${long.totalSeconds}`);
    check(`concept ${ct}: has overlay+image`, short.scenes.every(s => s.overlayText && s.imageNoun));
  }
}

// 9) resolveChildMode maps content types correctly
{
  check("resolve letters->abc", resolveChildMode("letters-sounds") === "abc");
  check("resolve numbers->counting", resolveChildMode("numbers-counting") === "counting");
  check("resolve colours->concept", resolveChildMode("colours-shapes") === "concept");
  check("resolve animals->concept", resolveChildMode("animals-nature") === "concept");
  check("resolve unknown->story", resolveChildMode("bedtime-soothing") === "story");
}

console.log(`\n${fail === 0 ? "ALL PASSED" : "SOME FAILED"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
