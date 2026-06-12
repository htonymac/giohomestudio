// Narration appearance-stripper (Henry 2026-06-12).
//
// WHY: Scene descriptions carry rich visual identity ON PURPOSE — image generation
// needs "Tobi, an 8-year-old boy with warm brown skin and dark hair" in every
// scene. But the NARRATOR must never read that aloud: viewers can see the actor.
// "Narrator only say Tobi" — appearance lives in pictures, not in narration.
//
// This strip is applied ONLY at the point of narration/subtitle text assembly —
// NEVER to the stored scene descriptions (stripping globally would destroy the
// scene-image identity work). Deterministic regex, no LLM, no API cost.
//
// Example in → out:
//   "Barker, a large, shaggy dog with dark brown skin and a fierce expression,
//    charges towards Tobi, an 8-year-old boy with warm brown skin and dark hair,
//    who runs in fear."
// → "Barker charges towards Tobi who runs in fear."

const LOOK_WORDS = "year[- ]?old|years?[- ]?old|skin|hair|eyes|complexion|features|melanated|build|stature|proportions|expression on";

export function stripAppearanceFromNarration(text: string): string {
  if (!text) return text;
  let t = text;

  // 1. Appositive descriptor after a name: ", a/an/the <desc with look-words>,"
  //    Allows ONE inner comma ("a large, shaggy dog with..."). Requires a look-word
  //    so plot appositives ("Tobi, the winner of the race,") survive.
  t = t.replace(
    new RegExp(`,\\s+(?:an?|the)\\s+(?:[^,.!?\\n]{0,60},\\s+)?[^,.!?\\n]{0,90}?\\b(?:${LOOK_WORDS})\\b[^,.!?\\n]{0,90}?,`, "gi"),
    " ",
  );

  // 2. Inline "with <looks>" phrases: "with warm brown skin and dark hair"
  t = t.replace(
    /\s+with\s+[^,.!?\n]{0,70}\b(?:skin|complexion|melanated|features|hair)\b[^,.!?\n]{0,40}(?=[,.!?\s])/gi,
    "",
  );

  // 3. "an 8-year-old boy named Tobi" → "Tobi"
  t = t.replace(/(?:an?\s+)?\d{1,2}[- ]?years?[- ]?old\s+(?:boy|girl|man|woman|child|kid)\s+(?:named|called)\s+/gi, "");

  // 4. Standalone "the 8-year-old boy" references → "the boy"
  t = t.replace(/\b(the\s+)\d{1,2}[- ]?years?[- ]?old\s+/gi, "$1");

  // Tidy artifacts: double spaces, space-before-punctuation, dangling commas
  return t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*([,.!?])/g, "$1")
    .trim();
}
