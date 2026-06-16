// GioHomeStudio — Hybrid Pipeline Step 2: Story Intelligence Expansion
//
// Takes user story input + optional controls and uses cloud LLM to expand
// into a structured production plan for hybrid video creation.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import namesData from "@/data/character-names.json";
import { buildFullLock } from "@/lib/era-culture-lock";

// ── Types ────────────────────────────────────────────────────────

interface StoryExpandRequest {
  storyInput: string;
  genre?: string;
  storyEra?: string;
  storyCulture?: string;
  tone?: string;
  targetDuration?: number;   // seconds
  targetDurationLabel?: string; // human label e.g. "15 min"
  language?: string;
  costPreference?: "free" | "low" | "medium" | "high";
  audience?: string;
  provider?: string; // "auto" | "claude" | "openai" | "grok" | "ollama" | "claude:claude-opus-4-6" | "openai:o3-mini" etc.
  tier?: "free" | "standard" | "pro"; // GHS AI tier — maps to model selection
  nameRegion?: string; // continent/region id for culturally authentic name injection
  nameStyle?: string;
  country?: string;
  languageLevel?: string; // e.g. "normal_english", "simple_english", "nigerian_english"
  storyType?: string;     // e.g. "short_story", "feature", "reel"
  contentType?: string;   // children content format: abc | 3letter | counting | poem | storybook | story
  emotionalIntensity?: string; // e.g. "normal", "high", "low"
  customNames?: string[]; // user-imported custom names (injected as approved pool)
  // Children-mode context — strict vocabulary + reading-level overrides when set.
  childContext?: {
    ageGroup?: "toddler" | "preschool" | "early" | "older";
    learningMode?: string;
    safetyLevel?: "high" | "medium" | "low" | string;
    visualStyle?: string;
  };
}

interface CharacterEntry {
  name: string;
  role: "hero" | "villain" | "narrator" | "support";
  description: string;
  age: string;
  gender: string;
  voiceStyle: string;
}

interface LocationEntry {
  name: string;
  description: string;
}

interface ExpandedStory {
  movieTitle?: string;
  summary: string;
  fullScript?: string;       // complete narration script scaled to target duration
  tone: string;
  pacingDirection: string;
  worldLogic: string;
  emotionLogic: string;
  narrativeArc: string;
  characterList: CharacterEntry[];
  locationList: LocationEntry[];
  soundSuggestions: string[];
  moodSuggestions: string[];
  actionPeaks: string[];
  narrationHeavyAreas: string[];
}

// ── Name pool builder ────────────────────────────────────────────
// Given a continent id (africa, asia, europe, ...) returns a shuffled sample
// of 8 male + 8 female authentic names for that region to inject into the prompt.

type RegionData = { male: string[]; female: string[]; label: string; cultures: string[] };
type NamesData = { continents: { id: string; label: string; regions: string[] }[]; regions: Record<string, RegionData> };

function buildNamePool(continentId: string): { block: string; culturalContext: string } | null {
  const data = namesData as unknown as NamesData;
  const continent = data.continents.find(c => c.id === continentId);
  if (!continent) return null;

  const allMale: string[] = [];
  const allFemale: string[] = [];
  const cultures: string[] = [];

  for (const regionId of continent.regions) {
    const region = data.regions[regionId];
    if (!region) continue;
    allMale.push(...region.male);
    allFemale.push(...region.female);
    cultures.push(...(region.cultures || []));
  }

  // Shuffle and pick 8 of each
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
  const malePool = shuffle(allMale).slice(0, 8);
  const femalePool = shuffle(allFemale).slice(0, 8);

  const block = `APPROVED NAME POOL for unnamed characters (${continent.label} culture):
- Male names: ${malePool.join(", ")}
- Female names: ${femalePool.join(", ")}
For any character whose name was NOT given by the user, choose ONLY from this pool. Do not invent Western/European names if this pool is provided.`;

  const culturalContext = `Cultural context: This story features characters from ${continent.label} (${cultures.slice(0, 5).join(", ")} cultural backgrounds). Use names, expressions, and details authentic to this region.`;

  return { block, culturalContext };
}

// ── Deterministic fallback ───────────────────────────────────────

function buildFallbackExpansion(input: StoryExpandRequest): ExpandedStory {
  return {
    summary: input.storyInput.slice(0, 300),
    tone: input.tone || "neutral",
    pacingDirection: "steady, building toward a climax in the final third",
    worldLogic: "realistic modern-day setting unless story suggests otherwise",
    emotionLogic: "gradual emotional escalation from curiosity to resolution",
    narrativeArc: "setup - rising tension - climax - resolution",
    characterList: [
      {
        name: "Protagonist",
        role: "hero",
        description: "The main character driving the story forward",
        age: "adult",
        gender: "unspecified",
        voiceStyle: "confident and warm",
      },
    ],
    locationList: [
      {
        name: "Primary Location",
        description: "The main setting where the story unfolds",
      },
    ],
    soundSuggestions: ["ambient background", "subtle tension cue", "resolution chime"],
    moodSuggestions: ["curiosity", "tension", "relief"],
    actionPeaks: ["midpoint confrontation", "climax moment"],
    narrationHeavyAreas: ["opening introduction", "emotional turning point"],
  };
}

// ── JSON extraction helper ───────────────────────────────────────
// Strips AI reasoning blocks (<think>...</think>, <analysis>...</analysis>)
// before extracting JSON — so reasoning-first prompts still parse cleanly.

function stripReasoningBlocks(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
}

function extractJSON(raw: string): unknown | null {
  const cleaned = stripReasoningBlocks(raw);

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // ignore
  }

  // Try to find JSON block in markdown fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // ignore
    }
  }

  // Try to find first { ... } block
  const braceStart = cleaned.indexOf("{");
  const braceEnd = cleaned.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
    } catch {
      // ignore
    }
  }

  return null;
}

// ── Validation helper ────────────────────────────────────────────

function isValidExpansion(obj: unknown): obj is ExpandedStory {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.summary === "string" &&
    typeof o.tone === "string" &&
    Array.isArray(o.characterList) &&
    Array.isArray(o.locationList)
  );
}

// ── POST handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StoryExpandRequest;

    if (!body.storyInput || typeof body.storyInput !== "string" || !body.storyInput.trim()) {
      return NextResponse.json(
        { ok: false, error: "storyInput is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // ── Duration → word count calculation ──────────────────────────────────
    // Average narration speed ≈ 130 words/min.
    // For movie time = narration + actor dialogue combined.
    const durSec = body.targetDuration || 120; // default 2 min
    const durMin = durSec / 60;
    const targetWordCount = Math.round(durMin * 130); // ~130 wpm
    const targetSceneCount = Math.max(3, Math.round(durMin * 1.5)); // ~1.5 scenes/min

    // Build the user prompt with all optional controls
    const controlLines: string[] = [];
    if (body.genre) controlLines.push(`Genre: ${body.genre}`);
    if (body.tone) controlLines.push(`Desired tone: ${body.tone}`);
    if (body.storyEra) controlLines.push(`Story era / time period: ${body.storyEra}`);
    if (body.storyCulture) controlLines.push(`Story culture / setting: ${body.storyCulture}`);
    if (body.targetDurationLabel) controlLines.push(`Target movie length: ${body.targetDurationLabel} (${durSec} seconds)`);
    if (body.language) controlLines.push(`Language: ${body.language}`);
    if (body.languageLevel) controlLines.push(`Language level/style: ${body.languageLevel.replace(/_/g, " ")}`);
    if (body.storyType) controlLines.push(`Story type: ${body.storyType.replace(/_/g, " ")}`);
    if (body.emotionalIntensity) controlLines.push(`Emotional intensity: ${body.emotionalIntensity}`);
    if (body.country) controlLines.push(`Story country/setting: ${body.country}`);
    if (body.costPreference) controlLines.push(`Cost preference: ${body.costPreference}`);
    if (body.audience) controlLines.push(`Target audience: ${body.audience}`);

    // ── Children-mode reading-level enforcement ────────────────────────────────
    // When children-planner sends childContext, inject strict vocabulary rules per age group.
    // Without these, the LLM writes a generic kids story with adult vocabulary.
    let childRules = "";
    // Poem / rhyme format — applied AFTER per-age rules below
    const wantsPoem = body.storyType === "rhyming_poem" || /\b(poem|poetry|rhyme|rhyming|verse|song|musical)\b/i.test(body.storyInput || "");

    // LENGTH ENFORCEMENT — fires for children stories where strict sentence-length rules
    // (3-7 word sentences max) would otherwise produce 300-word stories regardless of the
    // 5-min, 20-min, 40-min target. Tells the LLM to use MORE scenes/stanzas to compensate.
    const lengthEnforcement = body.childContext?.ageGroup
      ? `\n\n━━ LENGTH ENFORCEMENT — CRITICAL ━━
The vocabulary rules above LIMIT each sentence to be short. But the TOTAL story length MUST
still reach approximately ${targetWordCount} words (the user requested a ${durMin}-minute story).
To hit the target with short sentences, you MUST write MANY MORE scenes/stanzas. Do NOT
stop early. Keep adding scenes and beats until you reach the word target.
- For a ${durMin}-minute story: target ~${Math.round(durMin * 6)} scenes/beats minimum
- Each scene is a separate moment — new location OR new action OR new feeling
- If poem: ~${Math.round(durMin * 8)} four-line stanzas minimum
- LLM tendency: "I wrote a complete kid story in 200 words" — REJECTED.
- Required: fill the full ${targetWordCount}-word budget, even if it means more repetition,
  more scenes, more characters, more events. Length is non-negotiable.`
      : "";
    if (body.childContext?.ageGroup) {
      const ag = body.childContext.ageGroup;
      const safety = body.childContext.safetyLevel || "high";
      if (ag === "toddler") {
        // 2-3 year olds
        childRules = `\n\n━━ TODDLER READING RULES (2-3 years) — STRICT ━━
- USE MOSTLY 2-LETTER and 3-LETTER WORDS: cat, dog, sun, run, mom, dad, big, red, hi, up, in, on, go, no, hot, hat, sit, fun, see, eat, me, we, you, hug, fly, day, sky, see
- Some 4-letter words are OK: jump, play, blue, baby, bird, walk, ball, milk, time, bear, fish, frog, like, love
- AVOID any word longer than 5 letters unless absolutely essential. NO words like "wonderful", "discovered", "remembered", "important".
- SENTENCES: 3 to 5 words MAX. Example: "The cat sees the sun." NOT: "The cat looked out and noticed the warm bright sun shining."
- REPETITION IS GOOD: repeat the same simple phrase across scenes. Toddlers love repetition.
- CONCRETE NOUNS ONLY: things they can touch and see (animals, food, family, toys, weather). NO abstract concepts.
- NO sarcasm, irony, metaphor, or complex emotions. Just literal action.
- TONE: warm, gentle, predictable.
- SAFETY: ${safety} — no fear, no loss, no danger, no conflict. Happy resolution always.`;
      } else if (ag === "preschool") {
        // 3-5 year olds
        childRules = `\n\n━━ PRESCHOOL READING RULES (3-5 years) — STRICT ━━
- USE PRIMARILY 2, 3, AND 4-LETTER WORDS: cat, dog, sun, fun, big, red, mom, dad, run, jump, see, eat, play, walk, look, fish, bird, ball, milk, baby, blue, soft, kind, like, love, time, home, day, sky, tree, leaf, rock, sand, warm, cold, fast, slow, hop, sit, hug, hold, find, sing, swim, ride, draw.
- 5-LETTER WORDS ALLOWED SPARINGLY: happy, smile, water, green, table, chair, lunch, sleep, three, woods, mouse, tiger, smile.
- AVOID 6+ letter words. NO "wonderful", "magnificent", "adventure", "discovered", "remembered", "perfectly".
- SENTENCES: 4 to 7 words MAX. Example: "Tim and Ann run to the tree." Then: "They see a small fish jump."
- USE PHONICS-FRIENDLY WORDS: words a child can sound out (consonant + vowel patterns).
- REPETITION is encouraged — use the same phrase or rhyme across scenes for rhythm.
- CONCRETE STORIES: simple plot — go somewhere, see something, feel a small feeling, come back happy.
- NO scary content, NO loss, NO complex emotions. Curiosity and joy only.
- TONE: warm, playful, bedtime-friendly.
- SAFETY: ${safety} — happy ending always.`;
      } else if (ag === "early") {
        // 5-7 year olds
        childRules = `\n\n━━ EARLY READER RULES (5-7 years) — STRICT ━━
- USE WORDS UP TO 6 LETTERS COMFORTABLY. 7-letter words OK if phonetically clear.
- AVOID 8+ letter words unless they are sounded out easily (e.g. "butterfly" is OK).
- SENTENCES: 5 to 10 words. Mix short and slightly longer for rhythm.
- INTRODUCE simple feelings: happy, sad, scared, brave, kind, proud — but always resolve positively.
- Light conflict OK (lost ball, missing pet) — must resolve happily.
- TONE: encouraging, friendly, lessons about kindness/sharing/courage.
- SAFETY: ${safety} — gentle storylines only.`;
      } else if (ag === "older") {
        // 8-10 year olds
        childRules = `\n\n━━ OLDER CHILD READING RULES (8-10 years) ━━
- Normal vocabulary OK. Sentences 6 to 14 words.
- Real plot tension allowed — light suspense, friendship challenges, mild adventure.
- TONE: engaging, character-driven, age-appropriate excitement.
- SAFETY: ${safety} — no graphic violence, no adult themes.`;
      }
    }

    // Poem / rhyme overlay — fires when user explicitly asked for a poem
    let poemRules = "";
    if (wantsPoem) {
      poemRules = `\n\n━━ POEM / RHYME FORMAT — STRICT ━━
- Write the entire fullScript as a RHYMING POEM (NOT prose paragraphs).
- Use AABB or ABAB rhyme scheme — be consistent across the whole story.
- Each line should be 5-9 syllables (sing-song rhythm).
- Group lines into 4-line stanzas with a blank line between each stanza.
- Every stanza should advance the story by one beat (a scene, an action, a feeling).
- The rhyme MUST sound natural when read aloud — no awkward word inversions.
- Example pattern:
  "The sun came up so bright and round,
   The little cat jumped to the ground.
   She ran across the grassy lane,
   To find her friend who walked the same."`;
    }

    // ── Children content-format overlay (Bug A 2026-05-27) ───────────────
    // The children planner sets the format via URL ?content= (abc / 3letter /
    // counting / poem / storybook). Previously contentType never reached this
    // route, so EVERY format produced a generic story ("John took his friend to
    // learn abc"). Branch the prompt so each format does its real job. Defaults
    // to narrative (storybook/story) — unchanged behavior.
    let contentFormatRules = "";
    const ctype = (body.contentType || "").toLowerCase();
    if (ctype === "abc" || ctype === "alphabet" || ctype === "abc_song") {
      contentFormatRules = `\n\n━━ ALPHABET / ABC FORMAT — STRICT (this is NOT a story) ━━
- This is a TEACHING SCRIPT, absolutely NOT a narrative. There is NO plot, NO characters, NO
  villain, NO journey. Do NOT invent a story. If you write a story you have FAILED this task.
- Cover the FULL ALPHABET A→Z (all 26 letters), IN ORDER, ONE letter per scene — even if the
  user's pasted text only shows a few letters. The user's text is a PATTERN/EXAMPLE to follow,
  not the limit. Continue the SAME pattern through Z.
- MIRROR THE USER'S PATTERN exactly if their pasted text shows one. For example, if they wrote:
    "A is for Apple. / Look at the big red apple. / Apple starts with A. / A, A, Apple. /
     The apple is sweet. / Can you say Apple? / Great job! A is for Apple."
  then EVERY letter must follow that same multi-line shape (intro line, look-at line, "starts
  with" line, "X, X, Word" chant, two describe lines, "Can you say" line, praise line).
- If no pattern is given, use: "<LETTER> is for <Word>." + one short cheerful sentence.
- Each scene's visualDescription MUST clearly depict that letter's object (apple, ball, cat ...).
- Words must be concrete, common, age-appropriate. End with "Now you know your ABCs!"`;
    } else if (ctype === "3letter" || ctype === "spelling" || ctype === "cvc" || ctype === "words") {
      contentFormatRules = `\n\n━━ SPELLING / 3-LETTER WORD FORMAT — STRICT (NOT a story) ━━
- Teach simple words by SPELLING them — not a narrative.
- Use the words provided; if none, use simple CVC words (cat, sat, ram, jam, ran, dog, sun, hat).
- For each word: show it, spell it letter-by-letter, then use it once: "CAT — c, a, t — cat. The cat takes a nap."
- ONE word per scene; visualDescription depicts that word's object.`;
    } else if (ctype === "counting" || ctype === "numbers" || ctype === "count") {
      contentFormatRules = `\n\n━━ COUNTING / NUMBERS FORMAT — STRICT (NOT a story) ━━
- Teach counting — not a narrative. Count 1→N (1→10 for toddler/preschool, up to 1→20 for older).
- For each number: "<N> — <N>!" with exactly that many objects, e.g. "Three — one, two, three little ducks!"
- ONE number per scene; visualDescription shows EXACTLY that many objects. Invite the child to count along.`;
    }
    // poem handled by poemRules; storybook/story/unknown → narrative (default, unchanged)

    const controlBlock = (controlLines.length > 0
      ? `\n\nUser controls:\n${controlLines.join("\n")}`
      : "") + childRules + poemRules + contentFormatRules + lengthEnforcement;

    // ── Name pool injection ───────────────────────────────────────────────
    const namePool = body.nameRegion ? buildNamePool(body.nameRegion) : null;
    const customNamesBlock = (body.customNames && body.customNames.length > 0)
      ? `\n\nADDITIONAL APPROVED NAMES (user-imported): ${body.customNames.join(", ")}. You may use these for unnamed characters.`
      : "";
    const namePoolBlock = (namePool
      ? `\n\n${namePool.culturalContext}\n\n${namePool.block}`
      : "") + customNamesBlock;

    const userPrompt = `A creator has given you this brief story idea:
"""
${body.storyInput.trim()}
"""${controlBlock}${namePoolBlock}

You are going to turn this into a COMPLETE cinematic production. Here is what you must do:

━━ PRESERVE USER'S PLOT — READ FIRST, ALWAYS ━━
The story idea above is the SOURCE OF TRUTH. Your job is to EXPAND it into a full production
— NOT rewrite it. Preserve every element the creator wrote:
- Every species they named (cat, mouse, fox, etc.) — keep that species
- Every predator → prey relationship (e.g. "foxes want to eat the mice")
- Every threat, danger, or conflict the creator described
- Every rescue, ally, or resolution the creator described
- Every location change (e.g. "from city to rural area")
- The relationships between characters as the creator stated them
You may ADD: scene transitions, sensory detail, dialogue, side moments, sound cues, lighting.
You may NOT: invent new core plot points, change predator/prey to friends, drop a rescue arc,
relocate the story, or swap species for humans. If the creator wrote "rats running from foxes",
the output keeps rats, keeps foxes, keeps the chase. Do NOT make every character a friend group.

━━ CHARACTERS ━━
Find every character in the story above — both explicitly named and implied.

CRITICAL NAME RULE: If the creator already gave a character a specific name (e.g. "Vex", "Bryan", "Priya", "Rex", "Zara"), KEEP THAT EXACT NAME — never rename or relabel it. Only invent a name for roles that are unnamed or only implied (e.g. "a teacher", "some bullies", "a mysterious stranger").

For each character:
- Keep user-given names EXACTLY as written
- Invent names only for unnamed/implied roles
- Give each a completely distinct visual appearance, body type, and personality
- Every character must look and feel different from every other character

━━ SCRIPT ━━
Write a COMPLETE flowing narration script of approximately ${targetWordCount} words.
- Scene by scene, covering every plot beat from start to finish
- Written as a warm, engaging narrator would actually speak it aloud
- Use all character names you invented
- Cover the full ${Math.round(durMin)} minutes — DO NOT stop early or summarize

━━ STORY STRUCTURE ━━
Build approximately ${targetSceneCount} scenes across:
- Act 1 (setup): introduce characters and world warmly
- Act 2 (journey/conflict): rising tension, challenges, the antagonist threat
- Act 3 (climax + resolution): the peak moment and a satisfying emotional ending

Return ONLY this JSON — no explanation, no markdown fences:
{
  "movieTitle": "A short evocative cinematic title — 2 to 6 words, no punctuation at the end. Examples: 'The Snake Hunter', 'Last Day at Lagos', 'Karate Brothers', 'Whispers of the Forest', 'Riverbend Rebellion'. Capture the SPECIFIC emotional/dramatic core of THIS story, not a generic phrase. NEVER return placeholders like 'Untitled', 'My Story', or just the protagonist's name.",
  "inferredEra": "REQUIRED — the historical era / time period this story takes place in, inferred from its content (props, clothing cues, technology, names, setting). Be specific: 'Viking Age (~900 AD)', '18th century', '1990s', 'Contemporary 2024', 'Ancient Egypt', 'Medieval Europe', 'Feudal Japan', 'Wild West 1870s'. Vikings/longboats/axes → 'Viking Age (~900 AD)'. Default to 'Contemporary' ONLY if the story is clearly present-day. NEVER leave blank.",
  "inferredCulture": "REQUIRED — the cultural / regional setting inferred from the story: 'Norse / Scandinavian', 'Victorian England', 'Yoruba Kingdom', 'Contemporary Lagos', 'Edo Japan', 'American Frontier', etc. NEVER leave blank.",
  "summary": "2-3 sentences summarising the complete story using all character names",
  "tone": "e.g. heartfelt adventure / warm comedy / dark thriller / whimsical family",
  "pacingDirection": "describe how pace builds across the story",
  "worldLogic": "describe the world's setting and feel",
  "emotionLogic": "how the audience's emotions move from start to finish",
  "narrativeArc": "Act 1: setup. Act 2: tension. Act 3: climax and resolution.",
  "characterList": [
    {
      "name": "KEEP user-given name exactly — only invent for unnamed roles",
      "role": "hero|villain|narrator|support",
      "description": "species + visual appearance + personality — must be DIFFERENT from all other characters",
      "age": "child / teen / young adult / adult / elder",
      "gender": "male|female|unknown",
      "voiceStyle": "e.g. warm and playful / deep and commanding / bright and energetic"
    }
  ],
  "locationList": [
    {
      "name": "location name",
      "description": "rich visual + sensory description of this place"
    }
  ],
  "soundSuggestions": ["specific sound effects and music cues"],
  "moodSuggestions": ["2-4 mood keywords for visual direction"],
  "actionPeaks": ["2-3 key high-intensity or emotionally charged moments by name"],
  "narrationHeavyAreas": ["scenes where narration carries the story"],
  "scenes": [
    {
      "scene_number": 1,
      "title": "Short evocative scene title (e.g. 'Opening City View')",
      "video_prompt": "VIVID CINEMATIC scene description like a film director would write — action-first, NOT a character introduction. Show DRAMATIC MOTION, VFX, LIGHTING, ATMOSPHERE, and GENRE EFFECTS matched to the story's tone. 2-4 sentences. Required cinematic elements per scene: (1) Specific physical action verbs (leaping, slamming, soaring, blocking, exploding) — never 'stands' or 'looks at camera'. (2) Dramatic lighting (golden-hour rays, blue moonlight, sparks, flame glow, dust beams). (3) Environmental motion (dust kicked up, leaves blowing, sparks flying, smoke rolling, dappled sunlight shifting). (4) Genre-specific VFX: ninja/martial-arts stories get 'energy bursts, chi aura, motion streaks, dust kicked up by speed'; fantasy gets 'glowing runes, mist'; action gets 'explosion shockwaves, lens flares'; kid-friendly action gets 'whoosh streaks, bright cartoon impact lines'. (5) Cinematic camera language (low-angle hero shot, sweeping crane shot, slow-mo capture, handheld shake). (6) Match the story's tone — children's karate fight gets bright cartoon-style action energy with motion lines, not a static backyard photo. EXAMPLE for karate kid scene: 'Andrew leaps mid-roundhouse-kick, his foot slicing through a beam of golden-hour sunlight, dust spiraling from the impact zone as Bryan and Giovanna mirror his motion behind, energy streaks following their kicks, low-angle hero shot, slow-mo film frame.' DO NOT include character physical descriptions (age, skin, hair) — those come from the character database separately. JUST the scene's action and atmosphere.",
      "voiceover": "Narrator line for this scene — short, story-driving. Empty string if scene has dialogue instead.",
      "dialogue": [
        { "speaker": "Character name (must match characterList)", "line": "What they say in quotes" }
      ],
      "sfx_music": "Audio direction. E.g. 'Heroic drums, lightning zap, wind whoosh.' or 'Soft piano, children laughing.'",
      "location": "Where this scene happens",
      "mood": "1-2 word mood (joyful, tense, heroic, sad, hopeful)",
      "duration_seconds": "estimated scene length in seconds, integer"
    }
  ],
  "fullScript": "The complete narration — approximately ${targetWordCount} words. Scene by scene. Every beat covered. Written as a narrator speaks. Complete all scenes — do not stop or summarize early. If near the token limit, finish the current scene cleanly then write '[END]'."
}

━━ SCENES ARRAY — REQUIRED RICH OUTPUT ━━
You MUST produce a "scenes" array with one entry per scene. Match the example
storyboard structure: each scene has video_prompt (rich cinematic description),
voiceover OR dialogue array, and sfx_music (audio direction). This is how the
downstream image/video/audio pipeline consumes your output. Empty "dialogue":[]
when scene is narration-only; empty "voiceover":"" when scene is dialogue-driven.

Aim for: ~1 scene per ${Math.max(15, Math.round(durSec / 12))} seconds of story.`;

    const eraLock = buildFullLock(body.storyEra || "", body.storyCulture || "", ""); // 3rd arg is artStyle, NOT genre — passing genre here was a miswire (2026-05-27)
    const eraSystemContext = eraLock.sceneContext
      ? ` ${eraLock.sceneContext} The story MUST stay within the bounds of this era and culture throughout — characters must use only technology, clothing, language, and environments that existed in this time period and place.`
      : "";

    const systemPrompt =
      "You are GHS Story Intelligence — a creative story director and screenwriter. When given a brief story idea, you develop it into a full cinematic production: you invent character names, make every character visually and emotionally distinct from the others, write a complete flowing narration script at the requested length, and build a structured narrative arc. You respond ONLY with valid JSON. No markdown. No preamble. No explanation. Never truncate the fullScript — always write the complete script. " +
      // Species rule — bidirectional: do NOT default humans to animals, AND do NOT humanize animals.
      // Henry 2026-06-08: the old prompt only blocked human→bear drift. It overcorrected and
      // turned explicit cat/mice/fox stories into all-human casts. Fix preserves both directions.
      "CRITICAL SPECIES RULE — read both clauses: " +
      "(a) If the story idea does NOT mention animals or non-human creatures, characters are HUMAN. Do NOT default to bears, cartoon animals, or anthropomorphic creatures. " +
      "(b) If the story idea NAMES any animal species (cat, dog, mouse, rat, fox, bird, lion, horse, etc.) as a character, that character IS that animal — KEEP THE SPECIES. Do NOT treat 'cat' or 'mice' as nicknames for humans. Do NOT humanize animal characters. Do NOT replace them with children. The species named in the user's story is the actual species in the output. " +
      "Human characters have human anatomy, human skin tones, and human faces. Animal characters have that animal's anatomy and features." +
      eraSystemContext +
      ` LENGTH MANDATE: when a target length is given, the fullScript MUST reach approximately ${targetWordCount} words (the user asked for a ${durMin}-minute piece). Models often stop early thinking the story is "complete" — DO NOT. Keep adding scenes, events, dialogue and description until the word budget is met. A short script for a long request is a FAILURE.`;

    // Reasoning phase (~500 tokens) + full script + JSON overhead
    // thinking tags are stripped before parsing, but still count toward generation budget
    const maxTokens = Math.max(8000, Math.min(32000, targetWordCount * 2 + 2000));

    // Parse "provider:model" format e.g. "claude:claude-opus-4-6", "ollama:qwen2.5:7b", or plain "claude"
    let forceProvider: string | undefined;
    let forceModel: string | undefined;
    if (body.provider && body.provider !== "auto") {
      const colonIdx = body.provider.indexOf(":");
      if (colonIdx !== -1) {
        forceProvider = body.provider.slice(0, colonIdx) as "claude" | "openai" | "grok" | "ollama";
        forceModel = body.provider.slice(colonIdx + 1); // preserves full model id e.g. "qwen2.5:7b"
      } else {
        forceProvider = body.provider as "claude" | "openai" | "grok" | "ollama";
      }
    }

    // GHS AI Tier routing: free → ollama, standard → haiku (fast), pro → sonnet (quality)
    const tier = body.tier as "free" | "standard" | "pro" | undefined;
    if (tier === "free" && !forceProvider)  { forceProvider = "ollama"; }
    if (tier === "standard" && !forceProvider) { forceModel = forceModel || "claude-haiku-4-5-20251001"; }
    if (tier === "pro" && !forceProvider)   { forceModel = forceModel || "claude-sonnet-4-6"; }

    // Use user-selected provider or auto (Claude → GPT → Grok → Ollama)
    // Free tier force-routes to local Ollama with a SHORT timeout: on a GPU-less host
    // llama3.1:8b takes >5min to generate a story (unusable), so cap the attempt and
    // fall back to cloud below. A GPU host that answers within the cap keeps using Ollama.
    let llmResult = await callLLM(userPrompt, systemPrompt, {
      role: tier === "pro" ? "quality" as const : "fast" as const,
      temperature: 0.7,
      maxTokens,
      forceProvider: forceProvider as "claude" | "openai" | "gpt" | "grok" | "ollama" | undefined,
      forceModel,
      ...(forceProvider === "ollama" ? { timeoutMs: 45000 } : {}),
    });

    // FREE-TIER FALLBACK 2026-05-28: if the forced local Ollama attempt failed OR timed
    // out (down / no usable model / too slow on CPU), retry on cloud (auto Claude→GPT)
    // instead of 503ing. Without this the children planner died ("Ollama HTTP 404 — check
    // your API key") or hung for minutes on CPU inference.
    if (!llmResult.ok && forceProvider === "ollama" && !body.provider) {
      console.warn(`[story-expand] Ollama unusable (${llmResult.error}) — falling back to cloud (fast).`);
      llmResult = await callLLM(userPrompt, systemPrompt, {
        role: "fast" as const,
        temperature: 0.7,
        maxTokens,
        // no forceProvider → auto cloud chain
      });
    }

    // If we fell back off Ollama to cloud, continuation passes must NOT force Ollama
    // again (would hang on CPU). Use whatever provider actually answered.
    const succeededProvider = (llmResult as { provider?: string }).provider || "";
    const fellBackToCloud = forceProvider === "ollama" && !succeededProvider.startsWith("ollama");
    const contForceProvider = fellBackToCloud ? undefined : forceProvider;
    const contForceModel = fellBackToCloud ? undefined : forceModel;

    let expandedStory: ExpandedStory;

    if (llmResult.ok) {
      const parsed = extractJSON(llmResult.text);
      if (parsed && isValidExpansion(parsed)) {
        expandedStory = parsed;
      } else {
        // LLM returned something but it wasn't valid — log first 500 chars for debugging
        console.warn("[story-expand] LLM response failed JSON validation. Raw preview:", llmResult.text.slice(0, 500));
        // Return the raw text as an error so the caller can see what happened
        return NextResponse.json({
          ok: false,
          error: "AI returned a response but it could not be parsed as a story. Try again.",
          rawPreview: llmResult.text.slice(0, 300),
          provider: (llmResult as { provider: string }).provider,
        }, { status: 422 });
      }
    } else {
      // LLM call failed entirely — return a real error so the user knows to fix their API key
      console.warn(`[story-expand] All LLM providers failed: ${llmResult.error}`);
      return NextResponse.json({
        ok: false,
        error: `Story AI unavailable: ${llmResult.error}. Check your API key in Settings.`,
        provider: "none",
      }, { status: 503 });
    }

    // FIX 4 (2026-05-22): post-LLM word count validation.
    // Henry: children planner stories still come out short even with picker + tier:pro.
    // Models stop early when they think the story is "complete". This validation
    // catches sub-60% targets and surfaces a clear warning instead of silently
    // accepting a 200-word result for a 5-min target.
    // ── Iterative length fill (Bug B real fix 2026-05-27) ─────────────────────
    // A single LLM pass stops once the model thinks the story is "complete"
    // (~600 words even for a 20-min request). For long requests we run up to TWO
    // CONTINUATION passes: each asks the model to keep writing from where it left
    // off until the word budget is ~met, then we append the new text to fullScript
    // (which drives narration + video length downstream).
    //
    // Guards (fail-safe — never blocks or worsens the response):
    //   • only runs for long asks (target ≥ 400 words ≈ 3 min+)
    //   • max 2 passes; stops early once 85% of target is reached
    //   • a failed pass, or one that adds < 40 words, just keeps the shorter story
    let fullScriptWords = (expandedStory.fullScript || "").trim().split(/\s+/).filter(Boolean).length;
    let lengthPasses = 0;
    const wantsLongFill = targetWordCount >= 400;
    while (wantsLongFill && lengthPasses < 2 && fullScriptWords < targetWordCount * 0.85) {
      lengthPasses++;
      const wordsStillNeeded = Math.max(150, targetWordCount - fullScriptWords);
      const tail = (expandedStory.fullScript || "").split(/\s+/).slice(-120).join(" "); // last ~120 words for continuity
      const continuePrompt =
        `Continue the following children's ${ctype || "story"} script. It is too short: the target is about ` +
        `${targetWordCount} words and it currently has ${fullScriptWords}. Write roughly ${wordsStillNeeded} MORE ` +
        `words in the SAME style, voice, format, characters and reading level, picking up exactly where it stops. ` +
        `Do NOT repeat earlier lines, do NOT restart, do NOT add a title or preamble — return ONLY the additional ` +
        `script text.\n\n…${tail}`;
      const cont = await callLLM(continuePrompt, systemPrompt, {
        role: tier === "pro" ? ("quality" as const) : ("fast" as const),
        temperature: 0.7,
        maxTokens,
        forceProvider: contForceProvider as "claude" | "openai" | "gpt" | "grok" | "ollama" | undefined,
        forceModel: contForceModel,
        ...(contForceProvider === "ollama" ? { timeoutMs: 45000 } : {}),
      });
      if (!cont.ok || !cont.text?.trim()) break;                 // failed pass → keep what we have
      const addition = cont.text.trim();
      const addedWords = addition.split(/\s+/).filter(Boolean).length;
      if (addedWords < 40) break;                                // model had nothing more → stop looping
      expandedStory.fullScript = `${expandedStory.fullScript || ""} ${addition}`.trim();
      fullScriptWords += addedWords;
    }

    // FIX 4 (2026-05-22): post-LLM word count validation — warn if STILL short
    // after the continuation passes above, so the caller sees it instead of a
    // silently-tiny script.
    const shortfall = fullScriptWords < targetWordCount * 0.6;
    const warning = shortfall
      ? `Story is shorter than target. Got ${fullScriptWords} words (target ${targetWordCount} for ${durMin}-min) after ${lengthPasses} continuation pass(es). Try Pro tier / a different model.`
      : undefined;

    return NextResponse.json({
      ok: true,
      expandedStory,
      provider: (llmResult as { provider: string }).provider,
      wordCount: fullScriptWords,
      targetWordCount,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    console.error("[story-expand] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
