// Deterministic counting content — number words + countable objects with sounds.
// Used by buildChildScenes for "counting" mode. Pure data + small helpers.

export interface Countable {
  plural: string;     // "cows"
  singular: string;   // "cow"
  imageNoun: string;  // image subject, count is prepended: "3 cows in a field"
  sound: string;      // "Moo"
}

// Cycled by number so each count shows different friendly objects.
export const COUNTABLES: Countable[] = [
  { plural: "cows", singular: "cow", imageNoun: "cows in a green field", sound: "Moo" },
  { plural: "ducks", singular: "duck", imageNoun: "yellow ducks by a pond", sound: "Quack" },
  { plural: "cats", singular: "cat", imageNoun: "playful kittens", sound: "Meow" },
  { plural: "dogs", singular: "dog", imageNoun: "happy puppies", sound: "Woof" },
  { plural: "frogs", singular: "frog", imageNoun: "green frogs on lily pads", sound: "Ribbit" },
  { plural: "bees", singular: "bee", imageNoun: "smiling bees near flowers", sound: "Buzz" },
  { plural: "birds", singular: "bird", imageNoun: "little birds on a branch", sound: "Tweet" },
  { plural: "sheep", singular: "sheep", imageNoun: "woolly sheep on a hill", sound: "Baa" },
  { plural: "pigs", singular: "pig", imageNoun: "pink piglets", sound: "Oink" },
  { plural: "fish", singular: "fish", imageNoun: "colorful fish in water", sound: "Blub" },
  { plural: "stars", singular: "star", imageNoun: "gold stars in the night sky", sound: "Twinkle" },
  { plural: "apples", singular: "apple", imageNoun: "shiny red apples", sound: "Crunch" },
];

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 0..99 -> spelled word ("twenty-one"). Falls back to the digits above that. */
export function numberToWord(n: number): string {
  if (n < 0) return String(n);
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
  }
  return String(n);
}

export function countableFor(index: number): Countable {
  return COUNTABLES[((index % COUNTABLES.length) + COUNTABLES.length) % COUNTABLES.length];
}
