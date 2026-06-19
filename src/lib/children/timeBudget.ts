// Children "by-time" engine — the deterministic time -> content plan.
//
// THE FIX for "video doesn't work by time": instead of total length emerging from
// (narration / scene count), we compute an exact plan from the target duration:
// how many items (words/letters/numbers/sentences), how long each holds, and (if
// "Max" is on) how many images per item and the seconds per image — such that
// sum(item.onScreenSeconds) === targetSeconds EXACTLY.
//
// Pure + deterministic (no React, no fetch, no LLM, no Date/Math.random) so it is
// unit-testable and reproducible. Word selection lives in wordBank.ts (Phase 2);
// this file only does the time math.

import type { Age, ChildMode, ItemPlan, TimeBudgetInput, TimeBudgetPlan } from "./types";

// Nominal on-screen seconds per item, before the word-length factor. Younger =
// slower pacing (longer holds). These are the knobs that decide "how many words
// fill the time" — tune per age/mode after real review.
const BASE_SECONDS_PER_ITEM: Record<Age, Record<ChildMode, number>> = {
  toddler:   { spelling: 12, abc: 10, counting: 10, concept: 10, story: 6,   poem: 6   },
  preschool: { spelling: 10, abc: 9,  counting: 8,  concept: 9,  story: 6,   poem: 6   },
  early:     { spelling: 8,  abc: 7,  counting: 6,  concept: 7,  story: 5,   poem: 5   },
  older:     { spelling: 6,  abc: 6,  counting: 5,  concept: 6,  story: 4.5, poem: 4.5 },
};

// Never produce fewer than this many items even for a very short target.
const MIN_ITEMS: Record<Age, number> = { toddler: 3, preschool: 4, early: 5, older: 6 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Longer words need to hold on screen longer. 2-letter -> 0.84x, 5 -> 1.2x, 10 -> 1.8x.
function wordLengthFactor(wordLength: number | undefined): number {
  if (!wordLength || wordLength < 1) return 1;
  return clamp(0.6 + 0.12 * wordLength, 0.8, 2.2);
}

export function buildTimePlan(input: TimeBudgetInput): TimeBudgetPlan {
  const target = Math.max(5, Math.round(input.targetSeconds || 60));
  const base = BASE_SECONDS_PER_ITEM[input.age][input.mode];
  const lenFactor = input.mode === "spelling" ? wordLengthFactor(input.wordLength) : 1;
  const nominal = base * lenFactor;

  const itemCount = Math.max(MIN_ITEMS[input.age], Math.round(target / nominal));
  const perItemSeconds = target / itemCount;

  // "Max on" = the SAME item shown as several images, each ~secondsPerImage.
  // Clamp so we never ask for more image-slots than the item can hold.
  const spi = input.maxImages ? clamp(input.secondsPerImage ?? 4, 1, perItemSeconds) : perItemSeconds;
  const imagesPerItem = input.maxImages ? Math.max(1, Math.round(perItemSeconds / spi)) : 1;

  // Distribute time so the SUM is exactly the target: every item gets the nominal
  // per-item hold, and the LAST item absorbs the rounding remainder. Mirrors the
  // existing "last image eats the remainder" pattern in the assembler.
  const items: ItemPlan[] = [];
  let allocated = 0;
  for (let i = 0; i < itemCount; i++) {
    const isLast = i === itemCount - 1;
    const onScreenSeconds = isLast ? round2(target - allocated) : round2(perItemSeconds);
    allocated += onScreenSeconds;
    items.push({
      index: i,
      onScreenSeconds,
      imagesPerItem,
      secondsPerImage: round2(onScreenSeconds / imagesPerItem),
    });
  }

  const sectioned = target >= 600;
  const sectionSize = sectioned ? clamp(Math.round(Math.sqrt(itemCount)), 5, 12) : null;

  // Deterministic teaching modes get one short positioned TTS clip per item so the
  // narration timeline length == target; narrative modes keep one flowing clip.
  const narrationStrategy =
    input.mode === "story" || input.mode === "poem" ? "single-pass" : "per-item-tts";

  return { targetSeconds: target, itemCount, perItemSeconds, items, sectioned, sectionSize, narrationStrategy };
}
