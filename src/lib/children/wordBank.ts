// Deterministic children word bank — the "brain" for spelling content (no LLM).
// Words are keyed by [age][wordLength], every entry child-safe + imageable.
// `pickWords` selects N words for a time-budget plan: seeded (reproducible yet
// varied run-to-run), graded by length, and cycles gracefully for long videos.
//
// Curation rule (keep it true): every word must be (a) concrete/imageable,
// (b) phonetically sensible for its age, (c) pass the Phase-3 safety scanner.

import type { Age } from "./types";

export interface WordEntry {
  word: string;      // lowercase canonical, e.g. "cat"
  imageNoun: string; // image-gen subject, e.g. "a fluffy orange cat sitting"
}

const w = (word: string, imageNoun: string): WordEntry => ({ word, imageNoun });

// Length buckets that exist per age. Toddler caps ~4 letters; older reaches 10+.
// The `10` key holds 10-or-more-letter words.
export const WORD_BANK: Record<Age, Record<number, WordEntry[]>> = {
  toddler: {
    2: [w("go", "a green GO traffic light"), w("up", "a big arrow pointing up"), w("hi", "a child waving hello"), w("me", "a smiling child pointing to themselves"), w("we", "a happy group of children"), w("ox", "a friendly brown ox"), w("no", "a red stop sign"), w("on", "a glowing light bulb switched on")],
    3: [w("cat", "a fluffy orange cat"), w("dog", "a happy brown puppy"), w("sun", "a bright smiling sun"), w("hat", "a colorful party hat"), w("bus", "a yellow school bus"), w("cup", "a red cup"), w("pig", "a pink baby pig"), w("bed", "a cozy bed"), w("box", "a cardboard box"), w("egg", "a white egg"), w("bee", "a smiling bee"), w("cow", "a black and white cow"), w("car", "a small red car"), w("hen", "a brown hen"), w("ant", "a tiny black ant")],
    4: [w("ball", "a bouncy red ball"), w("fish", "a blue fish"), w("bird", "a little yellow bird"), w("milk", "a glass of milk"), w("frog", "a green frog"), w("duck", "a yellow duckling"), w("star", "a gold star"), w("cake", "a birthday cake"), w("shoe", "a small shoe"), w("tree", "a green tree"), w("bear", "a soft teddy bear"), w("moon", "a crescent moon")],
  },
  preschool: {
    2: [w("go", "a green GO light"), w("up", "an arrow pointing up"), w("hi", "a child waving"), w("we", "a group of friends"), w("me", "a child pointing to themselves")],
    3: [w("cat", "an orange cat"), w("dog", "a brown puppy"), w("sun", "a bright sun"), w("hat", "a party hat"), w("bus", "a yellow bus"), w("pig", "a pink pig"), w("bee", "a smiling bee"), w("cow", "a spotted cow"), w("fox", "a red fox"), w("owl", "a wise owl"), w("bat", "a baseball bat"), w("pen", "a blue pen"), w("jam", "a jar of jam"), w("web", "a spider web"), w("net", "a fishing net")],
    4: [w("ball", "a red ball"), w("fish", "a blue fish"), w("frog", "a green frog"), w("duck", "a yellow duck"), w("cake", "a birthday cake"), w("tree", "a tall tree"), w("star", "a gold star"), w("kite", "a colorful kite"), w("bell", "a golden bell"), w("drum", "a small drum"), w("leaf", "a green leaf"), w("rain", "falling rain drops"), w("nest", "a bird nest"), w("boat", "a little boat")],
    5: [w("apple", "a shiny red apple"), w("house", "a small cottage"), w("train", "a blue toy train"), w("chair", "a wooden chair"), w("plant", "a potted plant"), w("clock", "a round wall clock"), w("bread", "a loaf of bread"), w("cloud", "a fluffy white cloud"), w("horse", "a brown horse"), w("sheep", "a woolly sheep"), w("snake", "a friendly green snake"), w("zebra", "a striped zebra")],
  },
  early: {
    3: [w("cat", "an orange cat"), w("dog", "a puppy"), w("sun", "a bright sun"), w("fox", "a red fox"), w("owl", "an owl"), w("bee", "a bee")],
    4: [w("frog", "a green frog"), w("duck", "a duck"), w("star", "a gold star"), w("kite", "a kite"), w("boat", "a boat"), w("tree", "a tree"), w("moon", "the moon"), w("lion", "a friendly lion")],
    5: [w("apple", "a red apple"), w("house", "a house"), w("train", "a train"), w("plant", "a plant"), w("river", "a flowing river"), w("tiger", "a tiger"), w("robot", "a friendly robot"), w("brush", "a paint brush"), w("bread", "a loaf of bread"), w("grape", "a bunch of grapes")],
    6: [w("orange", "an orange fruit"), w("pencil", "a yellow pencil"), w("rabbit", "a white rabbit"), w("flower", "a pink flower"), w("garden", "a flower garden"), w("basket", "a woven basket"), w("rocket", "a space rocket"), w("turtle", "a green turtle"), w("monkey", "a playful monkey"), w("guitar", "an acoustic guitar")],
    7: [w("balloon", "a red balloon"), w("rainbow", "a colorful rainbow"), w("dolphin", "a leaping dolphin"), w("penguin", "a penguin"), w("cupcake", "a frosted cupcake"), w("dragon", "a friendly cartoon dragon"), w("teacher", "a friendly teacher"), w("library", "a row of books")],
  },
  older: {
    4: [w("star", "a star"), w("moon", "the moon"), w("lion", "a lion"), w("boat", "a sailboat")],
    5: [w("apple", "a red apple"), w("river", "a river"), w("tiger", "a tiger"), w("robot", "a robot"), w("globe", "a world globe"), w("plane", "an airplane")],
    6: [w("orange", "an orange"), w("rocket", "a rocket"), w("garden", "a garden"), w("pencil", "a pencil"), w("planet", "a ringed planet"), w("bridge", "a stone bridge")],
    7: [w("rainbow", "a rainbow"), w("dolphin", "a dolphin"), w("library", "books on a shelf"), w("compass", "a compass"), w("volcano", "a volcano"), w("octopus", "a smiling octopus")],
    8: [w("elephant", "a gray elephant"), w("dinosaur", "a friendly dinosaur"), w("mountain", "a snowy mountain"), w("umbrella", "a colorful umbrella"), w("sandwich", "a sandwich"), w("triangle", "a triangle shape"), w("hospital", "a hospital building"), w("computer", "a desktop computer")],
    10: [w("helicopter", "a helicopter"), w("strawberry", "a red strawberry"), w("playground", "a children's playground"), w("photograph", "a framed photograph"), w("watermelon", "a slice of watermelon"), w("basketball", "an orange basketball")],
  },
};

// Small deterministic PRNG so a given seed reproduces, but different seeds vary.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Nearest available length bucket for an age (down for toddler, up for older).
function resolveBucket(age: Age, wordLength: number): WordEntry[] {
  const buckets = WORD_BANK[age];
  if (buckets[wordLength]?.length) return buckets[wordLength];
  const lens = Object.keys(buckets).map(Number).sort((x, y) => x - y);
  let best = lens[0];
  let bestDist = Infinity;
  for (const L of lens) {
    const d = Math.abs(L - wordLength);
    if (d < bestDist) { bestDist = d; best = L; }
  }
  return buckets[best] || [];
}

/**
 * Pick `count` words for a spelling plan. Seeded (reproducible), shuffled for
 * variety, and CYCLES with reshuffle when count exceeds the bucket (long videos
 * legitimately repeat — children benefit from repetition). Pass a fresh seed
 * (Date.now()) for a different set each run; pass a fixed seed to reproduce.
 */
export function pickWords(age: Age, wordLength: number, count: number, seed: number): WordEntry[] {
  const bucket = resolveBucket(age, wordLength);
  if (!bucket.length || count <= 0) return [];
  const rnd = mulberry32(seed);
  const out: WordEntry[] = [];
  while (out.length < count) {
    for (const e of shuffle(bucket, rnd)) {
      out.push(e);
      if (out.length >= count) break;
    }
  }
  return out;
}
