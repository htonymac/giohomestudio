// Verify length honoring: a long target must trigger the continuation passes and
// reach ~the word budget instead of a ~200-word stub (Henry: "child planner make
// all story short"). 5-min target ≈ 750 words, ≥400 so the fill loop engages.
const body = {
  storyInput: "A kind little elephant who helps everyone in the jungle",
  contentType: "storybook",
  targetDuration: 300,
  targetDurationLabel: "5 min",
  tier: "free",
  audience: "children",
  childContext: { ageGroup: "early", learningMode: "story", safetyLevel: "high" },
};
const t0 = Date.now();
const res = await fetch("http://localhost:3200/api/hybrid/story-expand", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal: AbortSignal.timeout(170000),
});
const d = await res.json();
const es = d.expandedStory || d;
const fs = (es.fullScript || "").toString();
const words = fs.split(/\s+/).filter(Boolean).length;
console.log("HTTP", res.status, "| took", ((Date.now() - t0) / 1000).toFixed(0) + "s");
console.log("fullScript words:", words, "(5-min target ≈ 750)");
console.log("lengthWarning:", d.lengthWarning || es.lengthWarning || "(none)");
console.log("provider:", d.provider || "(?)");
console.log("VERDICT:", words >= 500 ? "LENGTH OK ✓ (continuation filled)" : words >= 250 ? "PARTIAL — short but not a stub" : "STILL SHORT ✗");
console.log("--- tail 200 chars ---\n" + fs.slice(-200));
