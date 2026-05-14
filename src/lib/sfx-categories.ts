// SFX Semantic Categories — Phase 4-C
// 60 categories mapping scene text keywords → SFX event IDs
// Used by matchSFXCategory() to auto-suggest SFX based on scene description

export const SFX_CATEGORIES = [
  { id: "explosion",    label: "Explosion / Blast",       keywords: ["explosion", "blast", "bomb", "detonate", "kaboom", "detonate", "erupt"] },
  { id: "footsteps",    label: "Footsteps",               keywords: ["walk", "run", "footstep", "step", "march", "stomp", "sprint", "jog", "tiptoe"] },
  { id: "door",         label: "Door / Creak",            keywords: ["door", "creak", "open", "close", "slam", "knock", "hinge", "gate"] },
  { id: "rain",         label: "Rain / Storm",            keywords: ["rain", "storm", "thunder", "lightning", "drizzle", "downpour", "hail", "cloudburst"] },
  { id: "crowd",        label: "Crowd / Cheer",           keywords: ["crowd", "cheer", "applause", "audience", "people", "shout", "chant", "roar", "murmur"] },
  { id: "water",        label: "Water / River",           keywords: ["water", "river", "stream", "splash", "ocean", "wave", "fountain", "waterfall", "lake", "drip"] },
  { id: "wind",         label: "Wind / Breeze",           keywords: ["wind", "breeze", "howl", "gust", "air", "draft", "hurricane", "tornado"] },
  { id: "fire",         label: "Fire / Crackle",          keywords: ["fire", "flame", "crackle", "burn", "blaze", "spark", "inferno", "ember", "campfire"] },
  { id: "sword",        label: "Sword / Combat",          keywords: ["sword", "fight", "battle", "clash", "blade", "strike", "slash", "parry", "duel", "combat"] },
  { id: "gunshot",      label: "Gunshot / Weapon",        keywords: ["gun", "shot", "bullet", "weapon", "shoot", "bang", "rifle", "pistol", "fire arm", "gunfire"] },
  { id: "car",          label: "Car / Engine",            keywords: ["car", "engine", "drive", "vehicle", "honk", "screech", "motor", "tire", "traffic", "rev"] },
  { id: "glass",        label: "Glass Break",             keywords: ["glass", "shatter", "break", "crash", "window", "mirror", "splinter", "shards"] },
  { id: "animal_dog",   label: "Dog / Bark",              keywords: ["dog", "bark", "growl", "puppy", "howl", "canine", "hound", "snarl"] },
  { id: "animal_cat",   label: "Cat / Meow",              keywords: ["cat", "meow", "purr", "kitten", "hiss", "feline", "tabby"] },
  { id: "animal_bird",  label: "Birds / Chirp",           keywords: ["bird", "chirp", "tweet", "wings", "flock", "eagle", "crow", "parrot", "owl", "hawk"] },
  { id: "bell",         label: "Bell / Chime",            keywords: ["bell", "chime", "ring", "ding", "toll", "gong", "church bell", "doorbell"] },
  { id: "electricity",  label: "Electricity / Zap",       keywords: ["electric", "zap", "spark", "buzz", "shock", "voltage", "static", "lightning bolt", "fuse"] },
  { id: "whoosh",       label: "Whoosh / Fast Move",      keywords: ["whoosh", "fast", "speed", "fly", "swipe", "slash", "dash", "blur", "swoosh", "rush"] },
  { id: "impact",       label: "Impact / Hit",            keywords: ["hit", "impact", "punch", "thud", "smack", "thump", "blow", "collision", "crash into"] },
  { id: "laugh",        label: "Laughter",                keywords: ["laugh", "giggle", "chuckle", "laughter", "cackle", "hysterical", "snicker", "titter"] },
  { id: "cry",          label: "Crying / Sobbing",        keywords: ["cry", "sob", "weep", "tears", "wail", "mourn", "grieve", "whimper", "sniffle"] },
  { id: "scream",       label: "Scream / Shriek",         keywords: ["scream", "shriek", "yell", "cry out", "shout", "howl", "wail", "bellow", "screech"] },
  { id: "music_box",    label: "Music Box / Lullaby",     keywords: ["music box", "lullaby", "soft music", "gentle tune", "nursery", "soothe", "crib"] },
  { id: "clock",        label: "Clock / Ticking",         keywords: ["clock", "tick", "tock", "time", "alarm", "watch", "timer", "countdown", "midnight"] },
  { id: "typing",       label: "Typing / Keyboard",       keywords: ["type", "keyboard", "click", "computer", "typing", "keypress", "laptop", "terminal"] },
  { id: "phone",        label: "Phone / Ring",            keywords: ["phone", "ring", "call", "mobile", "ringtone", "dial", "buzz", "notification", "alert"] },
  { id: "coin",         label: "Coin / Money",            keywords: ["coin", "money", "cash", "jingle", "currency", "payment", "gold", "treasure"] },
  { id: "leaves",       label: "Leaves / Nature",         keywords: ["leaves", "rustle", "forest", "nature", "tree", "branches", "foliage", "bush", "jungle"] },
  { id: "snow",         label: "Snow / Ice",              keywords: ["snow", "ice", "cold", "freeze", "blizzard", "frost", "frozen", "sleet", "chill"] },
  { id: "heartbeat",    label: "Heartbeat / Pulse",       keywords: ["heart", "heartbeat", "pulse", "thump", "beat", "cardiac", "chest", "nervous"] },
  { id: "magic",        label: "Magic / Sparkle",         keywords: ["magic", "sparkle", "spell", "enchant", "wand", "glitter", "shimmer", "fairy", "mystical"] },
  { id: "machine",      label: "Machine / Mechanical",    keywords: ["machine", "gear", "mechanical", "factory", "robot", "device", "contraption", "click clack"] },
  { id: "crowd_market", label: "Market / Busy Street",    keywords: ["market", "bazaar", "store", "shop", "street vendor", "haggle", "busy street", "hawker"] },
  { id: "jungle",       label: "Jungle / Wild",           keywords: ["jungle", "wild", "tropical", "rainforest", "safari", "insects", "cicadas", "frogs", "critters"] },
  { id: "church",       label: "Church / Choir",          keywords: ["church", "choir", "hymn", "worship", "prayer", "gospel", "sermon", "cathedral"] },
  { id: "helicopter",   label: "Helicopter / Aircraft",   keywords: ["helicopter", "aircraft", "plane", "jet", "chopper", "propeller", "turbine", "landing"] },
  { id: "train",        label: "Train / Rail",            keywords: ["train", "rail", "station", "locomotive", "track", "whistle", "subway", "metro"] },
  { id: "boat",         label: "Boat / Water Vessel",     keywords: ["boat", "ship", "vessel", "sail", "anchor", "horn", "waves", "sea", "harbor"] },
  { id: "crowd_fight",  label: "Fight Crowd / Brawl",     keywords: ["brawl", "fist fight", "melee", "chaos", "mob", "riot", "scuffle", "struggle"] },
  { id: "celebration",  label: "Celebration / Party",     keywords: ["celebration", "party", "birthday", "fireworks", "confetti", "popper", "toast", "clinking"] },
  { id: "whisper",      label: "Whisper / Secret",        keywords: ["whisper", "secret", "hush", "murmur", "sotto voce", "quiet voice", "barely audible"] },
  { id: "drum",         label: "Drums / Percussion",      keywords: ["drum", "percussion", "beat", "rhythm", "bongo", "djembe", "tribal", "bassline", "snare"] },
  { id: "horse",        label: "Horse / Hooves",          keywords: ["horse", "hooves", "gallop", "neigh", "stable", "stallion", "saddle", "bridle"] },
  { id: "crowd_angry",  label: "Angry Crowd / Protest",   keywords: ["protest", "angry crowd", "demonstration", "uprising", "revolt", "argument", "confrontation"] },
  { id: "ocean_waves",  label: "Ocean Waves / Beach",     keywords: ["ocean", "waves", "beach", "shore", "tide", "surf", "seagull", "coastal"] },
  { id: "door_lock",    label: "Lock / Unlock",           keywords: ["lock", "unlock", "key", "padlock", "chain", "latch", "deadbolt", "bolt"] },
  { id: "writing",      label: "Writing / Pen",           keywords: ["write", "pen", "pencil", "scribble", "paper", "notebook", "journal", "signing"] },
  { id: "engine_start", label: "Engine Start / Rev",      keywords: ["ignition", "starter", "engine start", "vroom", "rev up", "motorcycle", "acceleration"] },
  { id: "siren",        label: "Siren / Emergency",       keywords: ["siren", "police", "ambulance", "emergency", "alert siren", "alarm", "fire truck"] },
  { id: "crowd_stadium",label: "Stadium / Sports",        keywords: ["stadium", "crowd chanting", "goal", "referee", "whistle", "sports crowd", "match"] },
  { id: "cat_fight",    label: "Animal Fight",            keywords: ["animal fight", "growling", "hissing fight", "territorial", "wild animals", "predator prey"] },
  { id: "falling",      label: "Falling / Crash",         keywords: ["fall", "drop", "plummet", "tumble", "collapse", "topple", "crashing down"] },
  { id: "night_ambience", label: "Night / Crickets",      keywords: ["night", "cricket", "nocturnal", "nighttime", "owl hooting", "frog", "chirping insects"] },
  { id: "cooking",      label: "Cooking / Kitchen",       keywords: ["cook", "fry", "sizzle", "boil", "pot", "kitchen", "stir", "chop", "knife"] },
  { id: "school",       label: "School / Bell",           keywords: ["school", "classroom", "teacher", "children playing", "recess", "bell ring", "lesson"] },
  { id: "crowd_laugh",  label: "Audience Laugh / Studio", keywords: ["audience laugh", "studio audience", "sitcom", "joke", "comedian", "funny"] },
  { id: "construction", label: "Construction / Drill",    keywords: ["construction", "drill", "jackhammer", "hammering", "building", "scaffolding", "cement"] },
  { id: "money_drop",   label: "Money / Cash Register",   keywords: ["cash register", "till", "beep scan", "checkout", "money drop", "ka-ching"] },
  { id: "underwater",   label: "Underwater / Bubbles",    keywords: ["underwater", "bubbles", "diving", "submerge", "drowning", "deep water", "swimming"] },
  { id: "gate_open",    label: "Gate / Fence",            keywords: ["gate", "fence", "yard", "compound", "metal gate", "swing open", "barrier"] },
  { id: "crowd_prayer", label: "Prayer / Spiritual",      keywords: ["prayer", "mosque", "azaan", "call to prayer", "meditation", "chant", "incense", "spiritual"] },
] as const;

export type SFXCategoryId = typeof SFX_CATEGORIES[number]["id"];

/**
 * Match scene text against SFX categories.
 * Returns up to 5 matching category IDs sorted by keyword hit count.
 */
export function matchSFXCategory(sceneText: string): string[] {
  const lower = sceneText.toLowerCase();
  const scored = SFX_CATEGORIES
    .map(cat => ({
      id: cat.id,
      score: cat.keywords.filter(kw => lower.includes(kw)).length,
    }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(c => c.id);
  return scored;
}
