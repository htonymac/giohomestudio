// The deterministic children scene builder — the "brain" that turns a target
// duration into the RIGHT AMOUNT of teaching content (no LLM). This is the real
// fix for "a 60s and a 600s video look the same": the number of scenes is driven
// by buildTimePlan(target) + the word/number/letter banks, so 600s genuinely
// produces ~10x the items of 60s (count higher / more words / more rounds), each
// scene's duration summing to the exact target.
//
// Only spelling / counting / abc are deterministic here; story / poem stay on the
// existing LLM path.

import { buildTimePlan } from "./timeBudget";
import type { Age, ChildMode, ItemPlan } from "./types";
import { pickWords } from "./wordBank";
import { numberToWord, countableFor } from "./countingBank";
import { ABC } from "./abc";
import { conceptItemsFor, hasConceptBank } from "./conceptBank";

export interface BuiltScene {
  index: number;
  narration: string;        // spoken text for this scene (per-item TTS)
  overlayText: string;      // big flashcard text (word / number / abc word)
  flashcardLetter?: string; // first letter (words) or the letter (abc)
  imageNoun: string;        // image-gen subject
  onScreenSeconds: number;
  imagesPerItem: number;
  secondsPerImage: number;
}

export interface BuiltContent {
  mode: ChildMode;
  targetSeconds: number;
  itemCount: number;
  totalSeconds: number;     // == targetSeconds (sum of scene durations)
  scenes: BuiltScene[];
}

export interface BuildInput {
  mode: ChildMode;
  age: Age;
  targetSeconds: number;
  wordLength?: number;
  contentTypeId?: string;   // for "concept" mode (colours-shapes, animals-nature, …)
  seed: number;             // fresh (Date.now()) for variety; fixed to reproduce
  maxImages?: boolean;
  secondsPerImage?: number;
}

// Map a children-video content-type id (+ learning mode) to a deterministic
// ChildMode, or "story" when it should stay on the LLM path.
export function resolveChildMode(contentTypeId: string | undefined, learningMode?: string): ChildMode {
  const id = (contentTypeId || "").toLowerCase();
  if (/letter|phonic|abc|alphabet/.test(id) || learningMode === "phonics") return "abc";
  if (/number|count|maths/.test(id) || learningMode === "counting") return "counting";
  if (/spell|word|cvc|3letter|4letter|vocab/.test(id) || learningMode === "word") return "spelling";
  if (hasConceptBank(id)) return "concept";
  return "story";
}

// Highest number to count to before repeating in a new round with new objects —
// keeps it age-appropriate (a toddler counts to 5, not 75) while still filling time.
const COUNT_MAX: Record<Age, number> = { toddler: 5, preschool: 10, early: 20, older: 100 };

const DETERMINISTIC: ChildMode[] = ["spelling", "counting", "abc", "concept"];
export function isDeterministicMode(mode: ChildMode): boolean {
  return DETERMINISTIC.includes(mode);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function cap(s: string): string { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// Even split with the last item absorbing the rounding remainder (sum == target).
function distribute(target: number, itemCount: number, maxImages: boolean, secondsPerImage?: number): ItemPlan[] {
  const per = target / itemCount;
  const spi = maxImages ? Math.min(Math.max(secondsPerImage ?? 4, 1), per) : per;
  const imagesPerItem = maxImages ? Math.max(1, Math.round(per / spi)) : 1;
  const items: ItemPlan[] = [];
  let allocated = 0;
  for (let i = 0; i < itemCount; i++) {
    const onScreenSeconds = i === itemCount - 1 ? round2(target - allocated) : round2(per);
    allocated += onScreenSeconds;
    items.push({ index: i, onScreenSeconds, imagesPerItem, secondsPerImage: round2(onScreenSeconds / imagesPerItem) });
  }
  return items;
}

function timing(it: ItemPlan) {
  return { onScreenSeconds: it.onScreenSeconds, imagesPerItem: it.imagesPerItem, secondsPerImage: it.secondsPerImage };
}

export function buildChildScenes(input: BuildInput): BuiltContent {
  const { mode, age, targetSeconds, seed } = input;
  const wordLength = input.wordLength ?? 3;
  const maxImages = !!input.maxImages;
  const spi = input.secondsPerImage;

  if (!isDeterministicMode(mode)) {
    return { mode, targetSeconds, itemCount: 0, totalSeconds: 0, scenes: [] };
  }

  const conceptItems = mode === "concept" ? conceptItemsFor(input.contentTypeId || "") : null;
  if (mode === "concept" && (!conceptItems || conceptItems.length === 0)) {
    // No bank for this content type → caller falls back to the LLM path.
    return { mode, targetSeconds, itemCount: 0, totalSeconds: 0, scenes: [] };
  }

  // abc is fixed at 26 letters; spelling/counting/concept take their item count
  // from the time budget so the amount of content scales with the requested duration.
  const items =
    mode === "abc"
      ? distribute(targetSeconds, 26, maxImages, spi)
      : buildTimePlan({ targetSeconds, age, mode, wordLength, maxImages, secondsPerImage: spi }).items;
  const itemCount = items.length;

  const scenes: BuiltScene[] = [];

  if (mode === "spelling") {
    const words = pickWords(age, wordLength, itemCount, seed);
    for (let i = 0; i < itemCount; i++) {
      const e = words[i];
      const spelled = e.word.toUpperCase().split("").join(" — ");
      scenes.push({
        index: i,
        narration: `${cap(e.word)}. ${spelled}. ${cap(e.word)}!`,
        overlayText: e.word,
        flashcardLetter: e.word[0].toUpperCase(),
        imageNoun: e.imageNoun,
        ...timing(items[i]),
      });
    }
  } else if (mode === "counting") {
    const max = COUNT_MAX[age];
    for (let i = 0; i < itemCount; i++) {
      const n = (i % max) + 1;            // 1..max, repeating in rounds
      const round = Math.floor(i / max);
      const c = countableFor(round);      // different friendly objects each round
      const noun = n === 1 ? c.singular : c.plural;
      const sounds = Array(Math.min(n, 3)).fill(c.sound).join(", ");
      const countUp = Array.from({ length: n }, (_, k) => cap(numberToWord(k + 1))).join(", ");
      scenes.push({
        index: i,
        narration: `${cap(numberToWord(n))} ${noun}! ${sounds}! ${countUp}!`,
        overlayText: String(n),
        imageNoun: `${n} ${c.imageNoun}`,
        ...timing(items[i]),
      });
    }
  } else if (mode === "abc") {
    for (let i = 0; i < 26; i++) {
      const a = ABC[i];
      scenes.push({
        index: i,
        narration: `${a.letter}. ${a.letter} is for ${a.word}. ${a.sound}, ${a.sound}, ${a.word}!`,
        overlayText: a.word,
        flashcardLetter: a.letter,
        imageNoun: a.imageNoun,
        ...timing(items[i]),
      });
    }
  } else if (mode === "concept" && conceptItems) {
    // Colours / shapes / animals / feelings / body / first-words / actions / …
    // Enumerate the concept items, cycling in rounds for long videos (repetition
    // is good for young children). Each item = one scene; count scales with time.
    for (let i = 0; i < itemCount; i++) {
      const c = conceptItems[i % conceptItems.length];
      scenes.push({
        index: i,
        narration: c.line,
        overlayText: c.label,
        flashcardLetter: c.label[0].toUpperCase(),
        imageNoun: c.imageNoun,
        ...timing(items[i]),
      });
    }
  }

  const totalSeconds = round2(scenes.reduce((s, sc) => s + sc.onScreenSeconds, 0));
  return { mode, targetSeconds, itemCount: scenes.length, totalSeconds, scenes };
}
