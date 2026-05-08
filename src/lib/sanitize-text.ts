// sanitize-text.ts — clean text before sending to TTS
// Fixes UTF-8 mojibake that Piper reads aloud as "a circumflex euros" etc.

const MOJIBAKE: [RegExp, string][] = [
  [/â€"/g,  "-"],   // em dash U+2014
  [/â€™/g,  "'"],   // right single quote U+2019
  [/â€œ/g,  '"'],   // left double quote U+201C
  [/â€/g,   '"'],   // right double quote U+201D (must come after â€œ)
  [/â€¦/g,  "..."], // ellipsis U+2026
  [/â€˜/g,  "'"],   // left single quote U+2018
  [/Â·/g,   " "],   // middle dot
  [/Â /g,   " "],   // non-breaking space
  [/Â/g,    ""],    // stray Â prefix
  [/Ã©/g,   "e"],   // é
  [/Ã¨/g,   "e"],   // è
  [/Ã /g,   "a"],   // à
  [/Ã¢/g,   "a"],   // â
  [/Ã®/g,   "i"],   // î
  [/Ã´/g,   "o"],   // ô
  [/Ã»/g,   "u"],   // û
];

const SMART_PUNCT: [RegExp, string][] = [
  [/[—–]/g, "-"],   // em/en dash → hyphen
  [/[‘’]/g, "'"],   // curly single quotes → straight
  [/[“”]/g, '"'],   // curly double quotes → straight
  [/…/g,         "..."], // ellipsis → three dots
  [/ /g,         " "],   // non-breaking space → space
  [/·/g,         " "],   // middle dot → space
];

export function sanitizeForTTS(text: string): string {
  let t = text;

  // 1. Fix mojibake first (before smart punct replacement)
  for (const [pat, rep] of MOJIBAKE) {
    t = t.replace(pat, rep);
  }

  // 2. Replace smart punctuation with ASCII equivalents
  for (const [pat, rep] of SMART_PUNCT) {
    t = t.replace(pat, rep);
  }

  // 3. Strip remaining non-ASCII (anything above U+007E that wasn't already replaced)
  t = t.replace(/[^\x00-\x7E]/g, "");

  // 4. Collapse multiple spaces / clean up artifacts
  t = t.replace(/\s{2,}/g, " ").trim();

  return t;
}

// Quick validation: returns array of suspicious tokens found in text
export function detectTTSArtifacts(text: string): string[] {
  const patterns = ["circumflex", "euros", "euro", "â€", "â ", "Â", "Ã"];
  return patterns.filter(p => text.toLowerCase().includes(p.toLowerCase()));
}
