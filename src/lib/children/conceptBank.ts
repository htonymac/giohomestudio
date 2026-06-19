// Deterministic concept banks for ALL teaching content types (not just counting).
// Each content type is "enumerate friendly items, one per scene" — colours,
// shapes, animals, feelings, body parts, first words, actions. buildChildScenes
// scales the number of scenes with the target duration (cycling in rounds for
// long videos), so every child content type is time-driven, no LLM.
//
// Keyed by the children-video content-type id. A type not mapped here falls back
// to the existing LLM story path.

export interface ConceptItem {
  label: string;      // "Red" / "Circle" / "Cow" / "Happy"
  imageNoun: string;  // image-gen subject
  line: string;       // spoken teaching line
}

const COLOURS: ConceptItem[] = [
  { label: "Red", imageNoun: "a bright red apple", line: "Red! A red apple. Can you find something red?" },
  { label: "Blue", imageNoun: "a blue sky with a blue kite", line: "Blue! The blue sky. Point to something blue!" },
  { label: "Yellow", imageNoun: "a yellow sun", line: "Yellow! The yellow sun. Yellow is so bright!" },
  { label: "Green", imageNoun: "green grass and leaves", line: "Green! Green grass. Can you find green?" },
  { label: "Orange", imageNoun: "an orange fruit", line: "Orange! A juicy orange. Say orange!" },
  { label: "Purple", imageNoun: "purple grapes", line: "Purple! Yummy purple grapes. Purple!" },
  { label: "Pink", imageNoun: "a pink flower", line: "Pink! A pretty pink flower. Pink!" },
  { label: "Brown", imageNoun: "a brown teddy bear", line: "Brown! A soft brown bear. Brown!" },
  { label: "Black", imageNoun: "a black cat", line: "Black! A black cat. Black!" },
  { label: "White", imageNoun: "a fluffy white cloud", line: "White! A white cloud. White!" },
];

const SHAPES: ConceptItem[] = [
  { label: "Circle", imageNoun: "a round red circle", line: "Circle! Round like a ball. Circle!" },
  { label: "Square", imageNoun: "a blue square", line: "Square! Four equal sides. Square!" },
  { label: "Triangle", imageNoun: "a yellow triangle", line: "Triangle! Three sides, three corners. Triangle!" },
  { label: "Rectangle", imageNoun: "a green rectangle like a door", line: "Rectangle! Long like a door. Rectangle!" },
  { label: "Star", imageNoun: "a gold five-point star", line: "Star! A twinkly star. Star!" },
  { label: "Heart", imageNoun: "a pink heart", line: "Heart! A love-heart. Heart!" },
  { label: "Oval", imageNoun: "an oval egg shape", line: "Oval! Like an egg. Oval!" },
  { label: "Diamond", imageNoun: "a purple diamond shape", line: "Diamond! A shiny diamond. Diamond!" },
];

const ANIMALS: ConceptItem[] = [
  { label: "Cow", imageNoun: "a friendly cow in a field", line: "Cow! The cow says Moo. Moo, moo!" },
  { label: "Dog", imageNoun: "a happy puppy", line: "Dog! The dog says Woof. Woof, woof!" },
  { label: "Cat", imageNoun: "an orange cat", line: "Cat! The cat says Meow. Meow!" },
  { label: "Duck", imageNoun: "a yellow duck", line: "Duck! The duck says Quack. Quack!" },
  { label: "Sheep", imageNoun: "a woolly sheep", line: "Sheep! The sheep says Baa. Baa, baa!" },
  { label: "Pig", imageNoun: "a pink pig", line: "Pig! The pig says Oink. Oink!" },
  { label: "Horse", imageNoun: "a brown horse", line: "Horse! The horse says Neigh. Neigh!" },
  { label: "Frog", imageNoun: "a green frog", line: "Frog! The frog says Ribbit. Ribbit!" },
  { label: "Bee", imageNoun: "a smiling bee", line: "Bee! The bee says Buzz. Buzz!" },
  { label: "Lion", imageNoun: "a friendly lion", line: "Lion! The lion says Roar. Roar!" },
  { label: "Bird", imageNoun: "a little bird", line: "Bird! The bird says Tweet. Tweet!" },
  { label: "Owl", imageNoun: "a wise owl", line: "Owl! The owl says Hoo. Hoo, hoo!" },
];

const EMOTIONS: ConceptItem[] = [
  { label: "Happy", imageNoun: "a child with a big happy smile", line: "Happy! A big smile. When I play I feel happy!" },
  { label: "Sad", imageNoun: "a child with a sad face and a tear", line: "Sad! A frowny face. It's okay to feel sad." },
  { label: "Angry", imageNoun: "a child with a cross, angry face", line: "Angry! A grumpy face. Take a deep breath." },
  { label: "Surprised", imageNoun: "a child with a surprised face, wide eyes", line: "Surprised! Oh wow! A big surprise!" },
  { label: "Sleepy", imageNoun: "a child yawning, sleepy", line: "Sleepy! Yawn. Time to rest." },
  { label: "Scared", imageNoun: "a child looking a little worried but safe", line: "Scared! It's okay. A hug helps." },
  { label: "Excited", imageNoun: "a child jumping with excitement", line: "Excited! Yay! So much fun!" },
  { label: "Calm", imageNoun: "a child sitting peacefully", line: "Calm! Nice and quiet. Breathe in, breathe out." },
];

const BODY_PARTS: ConceptItem[] = [
  { label: "Head", imageNoun: "a child pointing to their head", line: "Head! Touch your head!" },
  { label: "Eyes", imageNoun: "a child pointing to their eyes", line: "Eyes! We see with our eyes!" },
  { label: "Nose", imageNoun: "a child pointing to their nose", line: "Nose! We smell with our nose!" },
  { label: "Mouth", imageNoun: "a child pointing to their smiling mouth", line: "Mouth! We talk and eat with our mouth!" },
  { label: "Ears", imageNoun: "a child pointing to their ears", line: "Ears! We hear with our ears!" },
  { label: "Hands", imageNoun: "a child holding up two hands", line: "Hands! Clap your hands!" },
  { label: "Feet", imageNoun: "a child pointing to their feet", line: "Feet! Stomp your feet!" },
  { label: "Tummy", imageNoun: "a child pointing to their tummy", line: "Tummy! Pat your tummy!" },
];

const FIRST_WORDS: ConceptItem[] = [
  { label: "Mama", imageNoun: "a smiling mother and child", line: "Mama! Say mama!" },
  { label: "Dada", imageNoun: "a smiling father and child", line: "Dada! Say dada!" },
  { label: "Hello", imageNoun: "a child waving hello", line: "Hello! Wave and say hello!" },
  { label: "Bye", imageNoun: "a child waving goodbye", line: "Bye-bye! Wave goodbye!" },
  { label: "More", imageNoun: "a child reaching for more food", line: "More! Say more, please!" },
  { label: "Please", imageNoun: "a child saying please politely", line: "Please! Such good manners. Please!" },
  { label: "Thank you", imageNoun: "a child saying thank you", line: "Thank you! We say thank you!" },
  { label: "Yes", imageNoun: "a child nodding yes", line: "Yes! Nod your head, yes!" },
  { label: "Water", imageNoun: "a cup of water", line: "Water! A nice drink of water!" },
  { label: "Ball", imageNoun: "a red ball", line: "Ball! Roll the ball!" },
];

const ACTIONS: ConceptItem[] = [
  { label: "Clap", imageNoun: "a child clapping hands", line: "Clap! Clap clap clap your hands!" },
  { label: "Jump", imageNoun: "a child jumping up", line: "Jump! Jump up high!" },
  { label: "Stomp", imageNoun: "a child stomping feet", line: "Stomp! Stomp stomp your feet!" },
  { label: "Spin", imageNoun: "a child spinning around", line: "Spin! Spin around and around!" },
  { label: "Wave", imageNoun: "a child waving", line: "Wave! Wave your hand!" },
  { label: "Dance", imageNoun: "a child dancing happily", line: "Dance! Dance dance dance!" },
  { label: "Hop", imageNoun: "a child hopping like a bunny", line: "Hop! Hop like a bunny!" },
  { label: "Wiggle", imageNoun: "a child wiggling", line: "Wiggle! Wiggle your body!" },
];

const WEATHER: ConceptItem[] = [
  { label: "Sunny", imageNoun: "a bright sunny day", line: "Sunny! The sun is shining. So warm!" },
  { label: "Rainy", imageNoun: "rain falling with an umbrella", line: "Rainy! Drip drop rain. Splash!" },
  { label: "Cloudy", imageNoun: "fluffy clouds in the sky", line: "Cloudy! Soft clouds in the sky." },
  { label: "Windy", imageNoun: "leaves blowing in the wind", line: "Windy! Whoosh! The wind blows." },
  { label: "Snowy", imageNoun: "gentle falling snow", line: "Snowy! Soft white snow. Brrr!" },
  { label: "Rainbow", imageNoun: "a colorful rainbow", line: "Rainbow! Red, blue, green — a rainbow!" },
];

const HELPERS: ConceptItem[] = [
  { label: "Doctor", imageNoun: "a friendly doctor", line: "Doctor! The doctor helps us feel better." },
  { label: "Teacher", imageNoun: "a friendly teacher", line: "Teacher! The teacher helps us learn." },
  { label: "Firefighter", imageNoun: "a friendly firefighter", line: "Firefighter! Puts out fires and keeps us safe." },
  { label: "Police", imageNoun: "a friendly police officer", line: "Police! Keeps everyone safe." },
  { label: "Farmer", imageNoun: "a friendly farmer", line: "Farmer! Grows our food." },
  { label: "Driver", imageNoun: "a friendly bus driver", line: "Driver! Drives the bus. Beep beep!" },
];

// content-type id -> the item list(s) to enumerate. Combine where the type covers
// more than one concept (e.g. colours-shapes = colours + shapes).
const CONCEPT_MAP: Record<string, ConceptItem[]> = {
  "colours-shapes": [...COLOURS, ...SHAPES],
  "colours": COLOURS,
  "colours-5": COLOURS,
  "shapes-6": SHAPES,
  "animals-nature": ANIMALS,
  "animal-sounds-12": ANIMALS,
  "feelings-faces": EMOTIONS,
  "social-emotional": EMOTIONS,
  "my-world": [...BODY_PARTS, ...FIRST_WORDS],
  "first-words": FIRST_WORDS,
  "first-words-10": FIRST_WORDS,
  "music-movement": ACTIONS,
  "science-discovery": WEATHER,
  "my-community": HELPERS,
};

export function conceptItemsFor(contentTypeId: string): ConceptItem[] | null {
  return CONCEPT_MAP[contentTypeId] ?? null;
}

export function hasConceptBank(contentTypeId: string): boolean {
  return !!CONCEPT_MAP[contentTypeId];
}
