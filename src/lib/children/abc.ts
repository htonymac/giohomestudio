// The alphabet bank — one imageable word per letter A–Z, for "abc" mode.
// Pure data; phonetically simple, child-safe.

export interface AbcEntry {
  letter: string;    // "A"
  word: string;      // "Apple"
  imageNoun: string; // "a shiny red apple"
  sound: string;     // the letter sound, "ah"
}

export const ABC: AbcEntry[] = [
  { letter: "A", word: "Apple", imageNoun: "a shiny red apple", sound: "ah" },
  { letter: "B", word: "Ball", imageNoun: "a bouncy red ball", sound: "buh" },
  { letter: "C", word: "Cat", imageNoun: "an orange cat", sound: "kuh" },
  { letter: "D", word: "Duck", imageNoun: "a yellow duck", sound: "duh" },
  { letter: "E", word: "Egg", imageNoun: "a white egg", sound: "eh" },
  { letter: "F", word: "Fish", imageNoun: "a blue fish", sound: "fff" },
  { letter: "G", word: "Goat", imageNoun: "a friendly goat", sound: "guh" },
  { letter: "H", word: "Hat", imageNoun: "a colorful hat", sound: "huh" },
  { letter: "I", word: "Igloo", imageNoun: "a snowy igloo", sound: "ih" },
  { letter: "J", word: "Jam", imageNoun: "a jar of jam", sound: "juh" },
  { letter: "K", word: "Kite", imageNoun: "a colorful kite", sound: "kuh" },
  { letter: "L", word: "Lion", imageNoun: "a friendly lion", sound: "lll" },
  { letter: "M", word: "Milk", imageNoun: "a glass of milk", sound: "mmm" },
  { letter: "N", word: "Nest", imageNoun: "a bird nest", sound: "nnn" },
  { letter: "O", word: "Orange", imageNoun: "an orange fruit", sound: "oh" },
  { letter: "P", word: "Pig", imageNoun: "a pink pig", sound: "puh" },
  { letter: "Q", word: "Queen", imageNoun: "a friendly cartoon queen", sound: "kwuh" },
  { letter: "R", word: "Rabbit", imageNoun: "a white rabbit", sound: "rrr" },
  { letter: "S", word: "Sun", imageNoun: "a bright smiling sun", sound: "sss" },
  { letter: "T", word: "Tree", imageNoun: "a green tree", sound: "tuh" },
  { letter: "U", word: "Umbrella", imageNoun: "a colorful umbrella", sound: "uh" },
  { letter: "V", word: "Van", imageNoun: "a small van", sound: "vvv" },
  { letter: "W", word: "Watch", imageNoun: "a wrist watch", sound: "wuh" },
  { letter: "X", word: "Box", imageNoun: "a cardboard box", sound: "ksss" },
  { letter: "Y", word: "Yo-yo", imageNoun: "a colorful yo-yo", sound: "yuh" },
  { letter: "Z", word: "Zebra", imageNoun: "a striped zebra", sound: "zzz" },
];
