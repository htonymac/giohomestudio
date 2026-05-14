// Dialogue emotion detection — used by TTS routes to add inflection cues.
//
// Why this exists: when a character says "Where are you?" we want a questioning
// tone, not a flat statement. ElevenLabs v3 supports emotion tags directly. Older
// models (v1, Piper, FAL Kokoro) don't — for those we just clean up adverbs in
// the text so the engine reads it more naturally.
//
// Stays in `src/lib` because it's used from multiple routes (tts, narrate-piper,
// dialogue/generate). Keep this self-contained — no I/O, no async.

export type Emotion =
  | "neutral"
  | "questioning"
  | "excited"
  | "shouting"
  | "whispered"
  | "hesitant"
  | "sad"
  | "fearful"
  | "angry";

export interface EmotionResult {
  emotion: Emotion;
  cleanText: string;        // text with directive adverbs removed (the speaker doesn't need to "say" the word "softly")
  v3Tagged: string;         // <emotion>cleanText</emotion> — for ElevenLabs v3
  confidence: number;       // 0-1, helps the caller decide whether to override a per-line manual emotion
  reason: string;           // short cue that triggered detection (debugging)
}

const ADVERB_HINTS: Array<{ re: RegExp; emotion: Emotion; reason: string }> = [
  { re: /\b(?:whispered|murmured|hushed|softly)\b/i,             emotion: "whispered",  reason: "whispered cue" },
  { re: /\b(?:shouted|yelled|screamed|bellowed|roared)\b/i,       emotion: "shouting",   reason: "shouting cue" },
  { re: /\b(?:hesitated|stammered|trailed off|mumbled)\b/i,       emotion: "hesitant",   reason: "hesitation cue" },
  { re: /\b(?:sobbed|cried|wept|grieved)\b/i,                     emotion: "sad",        reason: "grief cue" },
  { re: /\b(?:trembled|shook|quaked|gasped|terrified|fearful)\b/i,emotion: "fearful",    reason: "fear cue" },
  { re: /\b(?:fumed|raged|snapped|barked|growled)\b/i,            emotion: "angry",      reason: "anger cue" },
  { re: /\b(?:laughed|cheered|grinned|exclaimed|delighted)\b/i,   emotion: "excited",    reason: "joy cue" },
];

/**
 * Strip directive adverbs ("she whispered", "he shouted") from the spoken text.
 * The TTS engine should NOT vocalize the directive — it should *enact* it.
 */
function stripDirectives(text: string): string {
  return text
    .replace(/\s*,?\s*\b(?:whispered|murmured|hushed|softly|shouted|yelled|screamed|bellowed|roared|hesitated|stammered|mumbled|sobbed|cried|wept|grieved|trembled|gasped|fumed|raged|snapped|barked|growled|laughed|exclaimed|grinned)\b\s*,?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract emotion + cleaned text from a single dialogue line.
 *
 * Order of precedence (highest first):
 *   1. explicit adverb cue ("she whispered", "he shouted")
 *   2. ALL CAPS word run of 2+ words → shouting
 *   3. trailing ? → questioning
 *   4. trailing ! → excited (unless ALL CAPS already triggered shouting)
 *   5. trailing … or three+ dots → hesitant
 *   6. otherwise neutral
 *
 * Confidence is high (≥0.8) when an adverb fires; medium (0.6) when only
 * punctuation/CAPS triggers fire. The caller should use confidence to decide
 * whether a manually-set emotion should override.
 */
export function extractEmotion(rawText: string): EmotionResult {
  if (!rawText?.trim()) {
    return { emotion: "neutral", cleanText: "", v3Tagged: "", confidence: 0, reason: "empty" };
  }

  // 1. Adverb hints (highest confidence)
  for (const hint of ADVERB_HINTS) {
    if (hint.re.test(rawText)) {
      const clean = stripDirectives(rawText);
      return {
        emotion: hint.emotion,
        cleanText: clean,
        v3Tagged: `<${hint.emotion}>${clean}</${hint.emotion}>`,
        confidence: 0.9,
        reason: hint.reason,
      };
    }
  }

  // 2. All-caps run (2+ consecutive uppercase words → shouting)
  const allCapsMatch = rawText.match(/(?:\b[A-Z]{2,}\b\s*){2,}/);
  if (allCapsMatch) {
    // De-capitalize the matched run so the TTS engine doesn't read each letter individually
    const clean = rawText.replace(/(\b[A-Z]{2,}\b)/g, m => m.charAt(0) + m.slice(1).toLowerCase());
    return {
      emotion: "shouting",
      cleanText: clean,
      v3Tagged: `<shouting>${clean}</shouting>`,
      confidence: 0.7,
      reason: "all-caps run",
    };
  }

  // 3. Punctuation tail
  const tail = rawText.trim().slice(-3);
  if (/\?\s*$/.test(tail)) {
    return { emotion: "questioning", cleanText: rawText.trim(), v3Tagged: `<questioning>${rawText.trim()}</questioning>`, confidence: 0.65, reason: "trailing ?" };
  }
  if (/!\s*$/.test(tail)) {
    return { emotion: "excited", cleanText: rawText.trim(), v3Tagged: `<excited>${rawText.trim()}</excited>`, confidence: 0.6, reason: "trailing !" };
  }
  if (/\.{3,}\s*$|…\s*$/.test(rawText)) {
    return { emotion: "hesitant", cleanText: rawText.trim(), v3Tagged: `<hesitant>${rawText.trim()}</hesitant>`, confidence: 0.55, reason: "trailing ellipsis" };
  }

  // 4. Default neutral
  return { emotion: "neutral", cleanText: rawText.trim(), v3Tagged: rawText.trim(), confidence: 0.0, reason: "no cue" };
}

/**
 * Voice settings tweak for ElevenLabs based on detected emotion.
 * Keeps the *voice identity* but adjusts stability/style for inflection.
 *
 * Rule of thumb: lower stability = more expressive (more swing in tone).
 * Higher style = stronger emotional bias toward the trained emotion.
 */
export function elevenLabsSettingsFor(emotion: Emotion): { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean } {
  switch (emotion) {
    case "shouting":   return { stability: 0.30, similarity_boost: 0.85, style: 0.85, use_speaker_boost: true };
    case "excited":    return { stability: 0.35, similarity_boost: 0.80, style: 0.70, use_speaker_boost: true };
    case "questioning":return { stability: 0.45, similarity_boost: 0.75, style: 0.40, use_speaker_boost: true };
    case "whispered":  return { stability: 0.65, similarity_boost: 0.70, style: 0.20, use_speaker_boost: false };
    case "hesitant":   return { stability: 0.55, similarity_boost: 0.75, style: 0.30, use_speaker_boost: true };
    case "sad":        return { stability: 0.55, similarity_boost: 0.80, style: 0.50, use_speaker_boost: true };
    case "fearful":    return { stability: 0.40, similarity_boost: 0.80, style: 0.65, use_speaker_boost: true };
    case "angry":      return { stability: 0.30, similarity_boost: 0.85, style: 0.80, use_speaker_boost: true };
    case "neutral":
    default:           return { stability: 0.50, similarity_boost: 0.75, style: 0.20, use_speaker_boost: true };
  }
}

/**
 * Shared per-speaker pacing rule. Used by the dialogue concat route to insert
 * silent gaps between lines. Returns gap duration in ms.
 *
 *   Same speaker continuation     → 80 ms  (natural breath)
 *   Different speaker             → 220 ms (turn-taking beat)
 *   New scene / paragraph break   → 450 ms (story breath)
 */
export function gapMsBetween(prevSpeakerId: string | null, nextSpeakerId: string | null, sceneChanged: boolean): number {
  if (sceneChanged) return 450;
  if (!prevSpeakerId || !nextSpeakerId) return 220;
  return prevSpeakerId === nextSpeakerId ? 80 : 220;
}
