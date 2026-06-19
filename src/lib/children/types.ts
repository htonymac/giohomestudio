// Children "by-time" engine — shared types.
// One file = the vocabulary the time-budget / word-bank / safety modules agree on.
// Kept tiny on purpose (no logic here) so each sibling module stays single-purpose.

export type Age = "toddler" | "preschool" | "early" | "older";

// Deterministic teaching modes go through the time-budget + word-bank brain.
// Narrative modes (story/poem) keep the existing LLM + narration-first path.
export type ChildMode = "spelling" | "abc" | "counting" | "story" | "poem";

export type NarrationStrategy =
  | "per-item-tts" // one short clip per item, positioned — makes the timeline length == target
  | "single-pass"; // one narration clip for the whole script (story/poem)

export interface TimeBudgetInput {
  targetSeconds: number;     // the ONE unified duration (300 for "5 min")
  age: Age;
  mode: ChildMode;
  wordLength?: number;       // 2..10 for spelling; ignored for other modes
  maxImages?: boolean;       // "Max on" = one item shown as several images of the SAME thing
  secondsPerImage?: number;  // user-set; default 4 when maxImages is on
}

export interface ItemPlan {
  index: number;
  onScreenSeconds: number;   // total time this item (word/letter/number/sentence) holds
  imagesPerItem: number;     // 1 unless maxImages
  secondsPerImage: number;   // onScreenSeconds / imagesPerItem
}

export interface TimeBudgetPlan {
  targetSeconds: number;
  itemCount: number;         // number of words/letters/numbers/sentences
  perItemSeconds: number;    // nominal hold per item (pre-remainder)
  items: ItemPlan[];         // length === itemCount; sum(onScreenSeconds) === targetSeconds
  sectioned: boolean;        // true for long videos (>=600s) — grouped section-by-section
  sectionSize: number | null;
  narrationStrategy: NarrationStrategy;
}
