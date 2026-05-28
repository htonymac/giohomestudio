// Verify children ABC format: contentType=abc should produce an alphabet teaching
// piece ("A is for Apple"), NOT a generic story ("X took his friend to learn ABC").
const body = {
  storyInput: "ABC song for little kids",
  contentType: "abc",
  targetDuration: 90,
  targetDurationLabel: "1.5 min",
  tier: "free",
  audience: "children",
  childContext: { ageGroup: "preschool", learningMode: "abc", safetyLevel: "high" },
};
const res = await fetch("http://localhost:3200/api/hybrid/story-expand", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  signal: AbortSignal.timeout(150000),
});
const d = await res.json();
const es = d.expandedStory || d;
// Pull all teaching text: fullScript + scene prompts/narration + actionPeaks.
const sceneText = (es.scenes || []).map(s => [s.title, s.video_prompt, s.narration, s.narration_text, s.dialogue].filter(Boolean).join(" ")).join(" ");
const script = [es.fullScript, es.summary, (es.actionPeaks || []).join(" "), sceneText].filter(Boolean).join(" ").toString();
const words = script.split(/\s+/).filter(Boolean).length;
// Heuristics: alphabet format mentions many "X is for" / "A for" patterns
const forMatches = (script.match(/\b[A-Z]\b\s+(is\s+)?for\b/gi) || []).length;
const lettersCovered = new Set((script.match(/\b([A-Z])\b\s+(is\s+)?for/gi) || []).map(m => m[0].toUpperCase())).size;
console.log("HTTP", res.status, "| words:", words);
console.log("'X is for' patterns:", forMatches, "| distinct letters taught:", lettersCovered);
console.log("VERDICT:", forMatches >= 5 ? "ABC FORMAT ✓ (alphabet teaching)" : "STILL STORY MODE ✗");
console.log("--- first 320 chars ---\n" + script.slice(0, 320));
