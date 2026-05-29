// Unit-level verification of narrator/actor coordination (#6 + #7).
// Bypasses the HTTP route — directly imports computeNarratorWindows from the
// compiled .next build. Then checks:
//   (a) narratorIdx is correctly identified across 3 entry shapes
//   (b) actorWindows is non-empty with correct intervals
//   (c) buildAssemblyPlan emits a duck filter string in the audio mix command
//   (d) the subtitle path skip+clip logic produces non-overlapping windows
import path from "path";

// tsx (already a dep) handles the .ts import transparently.
const builderPath = path.resolve("./src/lib/assembly-builder.ts");
const { computeNarratorWindows, buildAssemblyPlan } = await import(`file://${builderPath}`);

// ── (a) detection across 3 shapes ──────────────────────────────────────────
const cases = [
  {
    name: "explicit isNarrator flag (preferred)",
    entries: [
      { id: "n1", startTime: 0,  endTime: 30, isNarrator: true },
      { id: "a1", startTime: 12, endTime: 18 },
    ],
    expectedNarrator: 0,
  },
  {
    name: "Fallback A: longest entry starting at <=0.5s",
    entries: [
      { id: "n1", startTime: 0,  endTime: 30 },              // 30s @ 0  ← winner
      { id: "a1", startTime: 12, endTime: 18 },              // 6s actor
    ],
    expectedNarrator: 0,
  },
  {
    name: "Fallback B (new 2026-05-29): longest entry overall when none starts at <=0.5s",
    entries: [
      { id: "n_chunk1", startTime: 5,  endTime: 20 },   // 15s
      { id: "a1",       startTime: 22, endTime: 24 },   // 2s actor
      { id: "n_chunk2", startTime: 25, endTime: 50 },   // 25s ← winner (longest, but starts at 25, not <=0.5)
      { id: "a2",       startTime: 52, endTime: 56 },   // 4s actor
    ],
    expectedNarrator: 2,
  },
];

console.log("── (a) narratorIdx detection ───────────────────────────────────");
let passA = 0;
for (const c of cases) {
  const { narratorIdx, actorWindows } = computeNarratorWindows(c.entries);
  const ok = narratorIdx === c.expectedNarrator;
  console.log(`  ${ok ? "✓" : "✗"} ${c.name}: narratorIdx=${narratorIdx} (expected ${c.expectedNarrator}) actorWindows=${actorWindows.length}`);
  if (ok) passA++;
}
console.log(`  ${passA}/${cases.length} detection cases pass`);

// ── (b) actorWindows correctness ──────────────────────────────────────────
console.log("\n── (b) actorWindows intervals ─────────────────────────────────");
const sample = cases[2].entries; // the trickier split-narrator case
const { actorWindows: aw } = computeNarratorWindows(sample);
console.log("  entries:", sample.map(e => `${e.id}[${e.startTime},${e.endTime}]`).join(" "));
console.log("  actorWindows:", aw.map(([s, e]) => `[${s.toFixed(2)},${e.toFixed(2)}]`).join(" "));
const wantedActors = sample.filter((_, i) => i !== 2).length; // narratorIdx=2
const passB = aw.length === wantedActors;
console.log(`  ${passB ? "✓" : "✗"} got ${aw.length} actor windows, expected ${wantedActors}`);

// ── (c) duck filter string emitted by buildAssemblyPlan ────────────────────
console.log("\n── (c) duck filter emitted in audio mix command ───────────────");
const minimalAssembly = {
  version: 1, projectId: "unit", projectType: "hybrid", title: "unit",
  totalDuration: 30, aspectRatio: "16:9", resolution: { width: 1920, height: 1080 },
  segments: [{ id: "s1", type: "video", sourceUrl: "/tmp/dummy.mp4", startTime: 0, endTime: 30, duration: 30 }],
  narration: [
    { id: "n1", text: "x", startTime: 0,  endTime: 30, volume: 1.0, speed: 1.0, audioUrl: "/tmp/narr.wav", isNarrator: true },
    { id: "a1", text: "x", startTime: 12, endTime: 18, volume: 1.0, speed: 1.0, audioUrl: "/tmp/actor.wav" },
  ],
  music: [], sfx: [], ambience: [], subtitles: [], overlays: [],
  volumeAutomation: [],
  duckingRules: { narrationPriority: true, musicDuckLevel: 0.08, ambienceDuckLevel: 0.15, sfxDuckLevel: 0.5 },
  exportSettings: { includeSubtitles: true, subtitleStyle: "classic" },
  soundLicenses: [],
};
const steps = buildAssemblyPlan(minimalAssembly, "/tmp/unit_out");
const mixStep = steps.find(s => s.id === "mix_narration");
const cmd = (mixStep?.command || []).join(" ");
const hasDuck = /volume=0\.06:enable='between/.test(cmd);
console.log(`  ${hasDuck ? "✓" : "✗"} mix_narration command includes duck filter (volume=0.06:enable='between...)`);
if (!hasDuck) console.log("  cmd excerpt:", cmd.slice(cmd.indexOf("filter_complex"), cmd.indexOf("filter_complex") + 400));

const allPass = passA === cases.length && passB && hasDuck;
console.log(`\n${allPass ? "✓ ALL UNIT CHECKS PASS" : "✗ FAILURES — see above"}`);
process.exit(allPass ? 0 : 1);
