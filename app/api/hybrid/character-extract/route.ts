// POST /api/hybrid/character-extract
// Step 3 — Character Extraction + Identity Registry
// Takes expandedStory (from step 2) + projectId, extracts characters,
// creates CharacterVoice records with persistent IDs.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { generateCharacterId } from "@/lib/character-id";
import type { CharacterIdentity } from "@/lib/hybrid-types";

// ── Default ElevenLabs voice map ─────────────────────────────
const VOICE_MAP: Record<string, { voiceId: string; voiceName: string }> = {
  hero:        { voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam" },
  protagonist: { voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam" },
  heroine:     { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah" },
  female_lead: { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah" },
  villain:     { voiceId: "VR6AewLTigWG4xSOukaG", voiceName: "Arnold" },
  antagonist:  { voiceId: "VR6AewLTigWG4xSOukaG", voiceName: "Arnold" },
  narrator:    { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel" },
  support:     { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh" },
  supporting:  { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh" },
  elder:       { voiceId: "yoZ06aMxZJJ28mfd3POQ", voiceName: "Sam" },
  child:       { voiceId: "jBpfuIE2acCO8z3wKNLl", voiceName: "Matilda" },
  comic_relief:{ voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh" },
};

// ── Role normalization ───────────────────────────────────────
function normalizeRole(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s-]/g, "_");
  const map: Record<string, string> = {
    hero: "protagonist",
    heroine: "protagonist",
    female_lead: "protagonist",
    main_character: "protagonist",
    lead: "protagonist",
    villain: "antagonist",
    bad_guy: "antagonist",
    enemy: "antagonist",
    support: "supporting",
    side_character: "supporting",
    sidekick: "supporting",
    narrator: "narrator",
    elder: "elder",
    child: "child",
    kid: "child",
    comic_relief: "comic_relief",
    funny: "comic_relief",
  };
  return map[lower] || lower;
}

// ── Resolve voice from role ──────────────────────────────────
function resolveVoice(roleType: string, gender?: string): { voiceId: string; voiceName: string } {
  // Try direct role match first
  const direct = VOICE_MAP[roleType];
  if (direct) return direct;

  // Gender-aware fallback for protagonist
  if (roleType === "protagonist" && gender) {
    const g = gender.toLowerCase();
    if (g === "female" || g === "girl") {
      return VOICE_MAP.heroine;
    }
  }

  // Default to support voice
  return VOICE_MAP.support;
}

// ── LLM extraction prompt ────────────────────────────────────
function buildExtractionPrompt(story: string): string {
  return `You are a story analysis engine. Extract ALL characters from this story.

For each character, return a JSON array with objects containing:
- name: character's full name (string)
- roleType: one of "hero", "heroine", "villain", "narrator", "support", "elder", "child", "comic_relief"
- gender: "male" or "female" — MUST match story words: "boy/man/he/his" = male, "girl/woman/she/her" = female
- species: REQUIRED — "human" for people; the ANIMAL TYPE for animal characters (e.g. "dog", "cat", "lion", "goat"). A character introduced as "a large shaggy dog" is species "dog", NEVER "human".
- age: REQUIRED — "child", "teen", "young_adult", "adult", or "elder"
- visualDescription: a brief visual description of appearance, clothing, and distinguishing features
- speechStyle: "normal", "whisper", "emotional", "commanding", or "trembling"
- country: country of origin if mentioned or implied (e.g. "Nigeria", "USA")
- skinTone: REQUIRED — skin tone and ethnic features (never blank)
- ethnicity: REQUIRED — racial/ethnic group (e.g. "Black", "Latina", "White", "Asian", "Middle Eastern", "South Asian")
- personality: one-sentence personality summary

CRITICAL — skinTone and age MUST always be filled. Never blank.

Skin tone inference rules (use these when story doesn't say literally):
- "Latina/Latino/Hispanic/Mexican/Cuban" → "olive-brown Latina skin, Hispanic features, dark hair, dark eyes"
- "Black/African-American/Nigerian/African/Yoruba/Igbo/Hausa" → "dark brown skin, African features, melanated"
- "Asian/Chinese/Japanese/Korean/Filipino/Vietnamese" → "fair Asian skin, East Asian features"
- "White/Caucasian/European/British/Irish/Italian/Russian" → "fair Caucasian skin, European features"
- "Middle Eastern/Arab/Persian/Turkish/Lebanese" → "olive-tan skin, Middle Eastern features"
- "Indian/South Asian/Pakistani/Bangladeshi" → "warm brown skin, South Asian features"
- "Native American/Indigenous" → "warm brown skin, Indigenous features"
- If story explicitly says skin color (e.g. "dark brown skin", "pale fair skin") → use that exact phrase
- If story gives NO ethnicity clue at all → look at country/setting; otherwise default to story's dominant ethnic context

Age inference rules — READ CAREFULLY, age extraction is high-stakes:
- EXPLICIT NUMERIC AGES in the story OVERRIDE everything else. Search the story for the character's name + nearby number-year phrases:
  * "8 years old", "age 8", "8-year-old", "aged 8" → if the number is 1-12 → "child"
  * 13-17 → "teen"
  * 18-29 → "young_adult"
  * 30-64 → "adult"
  * 65+ → "elder"
- If no explicit age number is near the character's name, use these word triggers:
  * "child/kid/boy/girl/youngster/youth/little" → "child"
  * "teen/teenager/teenage/adolescent/high school" → "teen"
  * "young man/young woman/college/in his twenties" → "young_adult"
  * "man/woman/middle-aged/thirties/forties" → "adult"
  * "elder/old/elderly/grandmother/grandfather/sixties or older" → "elder"
- If a character is described as a sibling of, parent of, or peer of a character with explicit age, match their age class.
- If truly ambiguous after all the above → "adult"
- DO NOT default to "adult" when the story has loud child cues like "his brothers", "his sister", "the kids", "schoolyard", "playground", "karate practice with friends", "the children". Match the cohort age.

Rules:
- Include EVERY character that speaks or is named
- If a narrator exists, include them as roleType "narrator"
- Do NOT invent characters that are not in the story
- Return ONLY the JSON array, no markdown fences, no explanation

Story:
${story}`;
}

// ── Deterministic story-truth corrections (Henry 2026-06-12) ─────────────────
// The LLM (and the characterList path, which bypasses the LLM prompt entirely)
// kept losing explicit story facts: "Tobi is an 8-year-old boy" extracted as a
// 20-year-old woman; "Barker, a large shaggy dog" extracted as a human. These
// helpers re-read the STORY TEXT and OVERRIDE the extraction when the story is
// explicit. Code, not model obedience.

const ANIMAL_WORDS = ["dog", "puppy", "cat", "kitten", "lion", "tiger", "bear", "wolf", "fox", "rabbit", "goat", "sheep", "cow", "horse", "donkey", "monkey", "elephant", "bird", "parrot", "chicken", "rooster", "hen", "duck", "goose", "pig", "rat", "mouse", "snake", "turtle", "fish", "frog", "squirrel", "deer", "leopard", "cheetah", "hyena", "zebra", "giraffe", "hippo", "crocodile"];

// "Barker, a large shaggy dog ..." / "the dog Barker" / "a dog named Barker" → species "dog".
// APPOSITIVE patterns only — a loose proximity window marked EVERY character in a
// short chase story as "dog" because the animal word was near all names (2026-06-12).
function speciesFromStory(name: string, story: string): string | null {
  const first = name.toLowerCase().split(/\s+/).filter(w => !["mr.", "mr", "mrs.", "mrs", "miss", "dr.", "dr"].includes(w))[0];
  if (!first) return null;
  const safe = first.replace(/[^a-z0-9]/g, "");
  if (!safe) return null;
  const animals = ANIMAL_WORDS.join("|");
  const patterns = [
    // "Barker, a large angry dog" — name, then appositive within a few words
    new RegExp(`\\b${safe}\\b\\s*,\\s*(?:a|an|the)\\s+(?:\\w+\\s+){0,3}(${animals})\\b`, "i"),
    // "a large dog named/called Barker"
    new RegExp(`\\b(?:a|an|the)\\s+(?:\\w+\\s+){0,3}(${animals})\\s+(?:named|called)\\s+${safe}\\b`, "i"),
    // "Barker the dog" / "the dog Barker"
    new RegExp(`\\b${safe}\\s+the\\s+(${animals})\\b`, "i"),
    new RegExp(`\\bthe\\s+(${animals})\\s+${safe}\\b`, "i"),
    // "Barker is a dog"
    new RegExp(`\\b${safe}\\b[^.!?]{0,30}\\bis\\s+(?:a|an)\\s+(?:\\w+\\s+){0,3}(${animals})\\b`, "i"),
  ];
  for (const p of patterns) {
    const m = story.match(p);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// "Tobi is an 8-year-old boy" → { ageClass: "child", gender: "male" }
function explicitAgeGenderFromStory(name: string, story: string): { ageClass?: string; gender?: string } {
  const first = name.toLowerCase().split(/\s+/).filter(w => !["mr.", "mr", "mrs.", "mrs", "miss", "dr.", "dr"].includes(w))[0];
  const out: { ageClass?: string; gender?: string } = {};
  if (!first) return out;
  const safe = first.replace(/[^a-z0-9]/g, "");
  if (!safe) return out;
  const re = new RegExp(`\\b${safe}\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(story)) !== null) {
    const win = story.slice(Math.max(0, m.index - 80), m.index + 120).toLowerCase();
    if (!out.ageClass) {
      const num = win.match(/\b(\d{1,2})[-\s]?(?:year|yr)s?[-\s]?old\b/) || win.match(/\bage[d]?\s+(\d{1,2})\b/);
      if (num) {
        const n = parseInt(num[1], 10);
        out.ageClass = n <= 12 ? "child" : n <= 17 ? "teen" : n <= 29 ? "young_adult" : n <= 64 ? "adult" : "elder";
      } else if (/\b(boy|girl|little kid|young child)\b/.test(win)) {
        out.ageClass = "child";
      } else if (/\b(grandma|grandmother|grandpa|grandfather|old man|old woman|elderly)\b/.test(win)) {
        out.ageClass = "elder";
      }
    }
    if (!out.gender) {
      if (/\b(boy|man|male|father|dad|grandpa|grandfather|uncle|brother|son|mr\.?)\b/.test(win)) out.gender = "male";
      else if (/\b(girl|woman|female|mother|mom|grandma|grandmother|aunt|sister|daughter|mrs\.?|miss)\b/.test(win)) out.gender = "female";
    }
    if (out.ageClass && out.gender) break;
  }
  return out;
}

// Human-visible age phrase prepended to the visual description so the image
// model can't render a child as an adult (mirrors scene-image AGE_VISUAL).
function agePhraseFor(ageClass: string, gender: string): string {
  const g = gender === "female" ? "girl" : gender === "male" ? "boy" : "child";
  switch (ageClass) {
    case "child":       return `8-10 year old ${g}, school-age child proportions, NOT an adult`;
    case "teen":        return `13-17 year old teenage ${gender === "female" ? "girl" : "boy"}`;
    case "young_adult": return `young adult in their early 20s`;
    case "elder":       return `elderly 65+ ${gender === "female" ? "woman" : "man"}, grey hair`;
    default:            return "";
  }
}

// Shared builder — leads with story-truth (species / explicit age) before skin tone.
function enrichedVisualDescriptionForTruth(isAnimal: boolean, species: string, age: string, gender: string, skinTone: string, visualDescription: string): string {
  const descLower = (visualDescription || "").toLowerCase();
  const alreadyHasSkin = /\b(skin|brown|dark|fair|pale|olive|melanated|complexion|black|white|asian|latina|latino|hispanic|african)\b/.test(descLower);
  const agePrefix = !isAnimal ? agePhraseFor(age, gender) : "";
  const parts: string[] = [];
  if (isAnimal) parts.push(`a ${species} (animal, NOT human)`);
  if (agePrefix) parts.push(agePrefix);
  if (skinTone && !alreadyHasSkin && !isAnimal) parts.push(skinTone);
  if (visualDescription) parts.push(visualDescription);
  return parts.join(", ").replace(/,\s*$/, "") || skinTone || "";
}

// Belt-and-suspenders: if LLM returned blank skinTone, infer from visualDescription/personality text
function inferSkinToneFromText(text: string): string {
  const t = (text || "").toLowerCase();
  if (/\b(latina|latino|hispanic|mexican|cuban|chicana|chicano|puerto\s*rican)\b/.test(t))
    return "olive-brown Latina skin, Hispanic features, dark hair, dark eyes";
  if (/\b(black|african[-\s]?american|nigerian|yoruba|igbo|hausa|african|west\s*african|east\s*african)\b/.test(t))
    return "dark brown skin, African features, melanated";
  if (/\b(asian|chinese|japanese|korean|filipino|vietnamese|thai|indonesian)\b/.test(t))
    return "fair Asian skin, East Asian features";
  if (/\b(middle\s*eastern|arab|arabic|persian|iranian|turkish|lebanese|egyptian)\b/.test(t))
    return "olive-tan skin, Middle Eastern features";
  if (/\b(indian|south\s*asian|pakistani|bangladeshi|sri\s*lankan)\b/.test(t))
    return "warm brown skin, South Asian features";
  if (/\b(native\s*american|indigenous|navajo|cherokee)\b/.test(t))
    return "warm brown skin, Indigenous features";
  if (/\b(white|caucasian|european|british|irish|italian|german|russian|scandinavian)\b/.test(t))
    return "fair Caucasian skin, European features";
  return "";
}

// ── Extract characters from LLM response ─────────────────────
function parseCharactersFromLLM(text: string): Array<Record<string, string>> {
  // Try to find JSON array in the response
  const trimmed = text.trim();
  // Strip markdown code fences if present
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.characters && Array.isArray(parsed.characters)) return parsed.characters;
    return [];
  } catch {
    // Try to extract array from within the text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

// ── Convert CharacterIdentity from expandedStory to our format ──
// Note: story-expand returns CharacterEntry objects with field 'name', not 'displayName'
function mapCharacterIdentity(ch: CharacterIdentity & { name?: string }, index: number): Record<string, string> {
  return {
    name: ch.name || ch.displayName || `Character ${index + 1}`,
    roleType: ch.roleType || "support",
    gender: ch.gender || "male",
    age: ch.ageRange || "adult",
    visualDescription: [ch.skinTone, ch.hairStyle, ch.facialTraits, ch.wardrobeStyle]
      .filter(Boolean).join(", ") || "",
    speechStyle: ch.speechStyle || "normal",
    country: "",
    skinTone: ch.skinTone || "",
    personality: ch.emotionProfile || "",
  };
}

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { expandedStory, projectId } = body;
    // Henry 2026-06-12: planner's Region/Culture selection. When set, it beats the
    // diversity rotation — a story set in Nigeria gets Nigerian characters, not a
    // by-index Latina/Caucasian/African spread.
    const storyCulture: string = typeof body.storyCulture === "string" ? body.storyCulture : "";

    if (!expandedStory) {
      return NextResponse.json(
        { error: "expandedStory is required" },
        { status: 400 },
      );
    }

    // ── Step 1: Get character list ─────────────────────────────
    let rawCharacters: Array<Record<string, string>> = [];

    if (expandedStory.characterList && Array.isArray(expandedStory.characterList) && expandedStory.characterList.length > 0) {
      // Use characterList directly from step 2 expansion
      rawCharacters = expandedStory.characterList.map(
        (ch: CharacterIdentity, i: number) => mapCharacterIdentity(ch, i),
      );
    } else {
      // Fall back to LLM extraction from the story text
      const storyText = expandedStory.summary
        || expandedStory.narrativeArc
        || (typeof expandedStory === "string" ? expandedStory : JSON.stringify(expandedStory));

      const llmResult = await callLLM(
        buildExtractionPrompt(storyText),
        "You are a precise story analyst. Return only valid JSON.",
        { role: "quality", maxTokens: 2000 },
      );

      if (!llmResult.ok) {
        return NextResponse.json(
          { error: `LLM extraction failed: ${llmResult.error}` },
          { status: 502 },
        );
      }

      rawCharacters = parseCharactersFromLLM(llmResult.text);

      if (rawCharacters.length === 0) {
        return NextResponse.json(
          { error: "No characters could be extracted from the story" },
          { status: 422 },
        );
      }
    }

    // ── Step 2: Create CharacterVoice records ──────────────────
    const createdCharacters: Array<{
      characterId: string;
      name: string;
      role: string;
      gender: string;
      age: string;
      voiceId: string;
      voiceName: string;
      dbId: string;
      visualDescription: string;
      skinTone: string;
      ageRange: string;
      colorDescription: string;
      species: string;
    }> = [];

    // ── Option B: Story-wide dominant ethnicity ──
    // Walk the entire expandedStory ONCE, extract dominant ethnicity. Used per-character
    // when the LLM defaulted to "fair/light" — if the story is overwhelmingly Black/
    // Latina/Asian/etc., apply that dominant unless the character has an explicit
    // contradicting ethnicity word near their name.
    let _dominantSkin = "";
    let _combinedStory = "";
    // Henry 2026-06-08: strength check on dominance.
    // Old behavior: ONE stray "African" word in story background → entire cast forced Black.
    // Henry's screenshot showed all-Black cast on a cat/mice story with zero explicit ethnicity.
    // New rule: only treat dominance as "strong" when ethnic words appear 3+ times in the
    // story OR an explicit country/culture input was provided via the request body.
    let _dominantIsStrong = false;
    if (expandedStory && typeof expandedStory === "object") {
      const allText: string[] = [];
      const walk = (val: unknown) => {
        if (typeof val === "string") allText.push(val);
        else if (Array.isArray(val)) val.forEach(walk);
        else if (val && typeof val === "object") Object.values(val).forEach(walk);
      };
      walk(expandedStory);
      _combinedStory = allText.join(" ").toLowerCase().slice(0, 20000);
      _dominantSkin = inferSkinToneFromText(_combinedStory);
      if (_dominantSkin) {
        // Count how many distinct ethnic mentions support the dominance.
        const ethnicWordRegex = /\b(latina|latino|hispanic|mexican|cuban|black|african|nigerian|yoruba|igbo|hausa|asian|chinese|japanese|korean|filipino|vietnamese|middle\s*eastern|arab|persian|turkish|lebanese|indian|south\s*asian|pakistani|bangladeshi|native\s*american|indigenous|navajo|cherokee|white|caucasian|european|british|irish|italian|german|russian|scandinavian)\b/g;
        const ethnicMatches = _combinedStory.match(ethnicWordRegex) || [];
        _dominantIsStrong = ethnicMatches.length >= 3;
      }
    }
    // Raw story text the story-truth helpers scan (lowercased by the walk above;
    // helpers are case-insensitive). Falls back to a string expandedStory.
    const _storyTextForTruth = _combinedStory || (typeof expandedStory === "string" ? (expandedStory as string).toLowerCase() : "");

    const LIGHT_DEFAULT_PATTERN = /\b(fair|pale|light\s+tan|light\s+skin|caucasian|peach|cream)\b/i;
    const dominantIsNonLight = _dominantSkin && !/\b(fair|pale|light|caucasian)\b/i.test(_dominantSkin);
    if (_dominantSkin) {
      console.log(`[character-extract] Story dominant ethnicity: "${_dominantSkin}" (strong=${_dominantIsStrong})`);
    }

    // Diversity rotation pool — used when story has NO explicit per-character ethnicity AND
    // dominance is weak. Spreads cast across continents instead of forcing one tone.
    // Henry 2026-06-08: complaint "show everyone black it does not also show white" — this
    // pool restores a mixed cast in the no-context default.
    const DIVERSITY_POOL: string[] = [
      "warm brown skin, Latina/Hispanic features, dark hair, dark eyes",
      "fair Caucasian skin, European features, light hair or brown hair",
      "dark brown skin, African features, melanated",
      "fair Asian skin, East Asian features, dark hair",
      "warm brown skin, South Asian features, dark hair",
      "olive-tan skin, Middle Eastern features, dark hair, dark eyes",
    ];

    // Culture-derived skin tone — used instead of the rotation pool when the
    // planner told us where the story is set (Henry 2026-06-12).
    // Fallback when no Region was picked: recognizably West-African names/places
    // in the story (Tobi, Okafor, Lagos…) are a culture signal even though the
    // story contains no literal word like "Nigerian" — 2+ distinct hits required
    // so one ambiguous name can't flip a whole cast.
    const AFRICAN_NAME_HINTS = ["tobi", "okafor", "okonkwo", "emeka", "ngozi", "chinedu", "adebayo", "tunde", "yusuf", "amina", "obi", "nneka", "folake", "segun", "femi", "bola", "chioma", "uche", "ifeanyi", "kelechi", "sade", "kemi", "wale", "dele", "sola", "taiwo", "kehinde", "eze", "nnamdi", "yemi", "lagos", "abuja", "ibadan", "kano", "naira", "danfo", "okada", "agbada", "ankara"];
    let nameHintSkin = "";
    {
      const hits = new Set<string>();
      for (const h of AFRICAN_NAME_HINTS) {
        if (new RegExp(`\\b${h}\\b`, "i").test(_combinedStory)) hits.add(h);
      }
      if (hits.size >= 2) {
        nameHintSkin = "dark brown skin, African features, melanated";
        console.log(`[character-extract] African name-hint culture signal: ${[...hits].join(", ")}`);
      }
    }
    const cultureSkin = (storyCulture ? inferSkinToneFromText(storyCulture) : "") || nameHintSkin;

    for (let i = 0; i < rawCharacters.length; i++) {
      const ch = rawCharacters[i];
      const name = (ch.name || `CHARACTER_${i + 1}`).toUpperCase().trim();
      const roleType = normalizeRole(ch.roleType || "support");

      // ── STORY-TRUTH OVERRIDES (Henry 2026-06-12) ──────────────────────────
      // Re-read the raw story; explicit facts beat the LLM AND the characterList
      // path (which bypasses the extraction prompt and defaulted everyone to
      // "adult"). This is what stops "8-year-old boy Tobi" becoming a 20yo woman
      // and "Barker, a large shaggy dog" becoming a human.
      const truth = explicitAgeGenderFromStory(name, _storyTextForTruth);
      const storySpecies = speciesFromStory(name, _storyTextForTruth);
      const species = (storySpecies || ch.species || "human").toLowerCase();
      const isAnimal = species !== "human" && species.length > 0;

      const gender = truth.gender || ch.gender || "male";
      const age = truth.ageClass || ch.age || "adult";
      if (truth.ageClass || truth.gender || storySpecies) {
        console.log(`[character-extract] story-truth override for ${name}: age=${truth.ageClass || "-"} gender=${truth.gender || "-"} species=${storySpecies || "-"}`);
      }
      const visualDescription = ch.visualDescription || "";
      const speechStyle = ch.speechStyle || "normal";
      const country = ch.country || "";
      const personality = ch.personality || "";
      // skinTone fallback chain: LLM-extracted → inferred from visualDescription/personality/ethnicity → story scan → empty
      const ethnicity = ch.ethnicity || "";
      let skinTone = ch.skinTone || "";
      if (!skinTone) {
        skinTone = inferSkinToneFromText(
          [visualDescription, personality, ethnicity, country].filter(Boolean).join(" "),
        );
      }
      // Empty-skinTone fallback: use precomputed story-wide dominant
      if (!skinTone && _dominantSkin) {
        skinTone = _dominantSkin;
      }

      // ── Option B override: LLM defaulted to generic-light when story dominant is non-light ──
      // Catches cases like "Story has 3 Black inventors but LLM put 'fair skin' for Andre".
      // Only overrides when:
      //   1. Story's dominant ethnicity is non-light (Black/Latina/Asian/etc.)
      //   2. Dominance is STRONG (3+ ethnic word mentions, not one stray reference)
      //   3. This character's skinTone is generic-light from the LLM default
      //   4. The character does NOT have an explicit light-skin ethnicity word near their name
      //      in the story text (so "Black Malik and white Andre" still respects Andre's white)
      // Henry 2026-06-08: added strength check. Weak dominance no longer homogenizes the cast.
      if (dominantIsNonLight && _dominantIsStrong && LIGHT_DEFAULT_PATTERN.test(skinTone)) {
        const firstName = name.toLowerCase().split(/\s+/)[0];
        const nameRegex = new RegExp(`\\b${firstName.replace(/[^a-z0-9]/g, "")}\\b`, "g");
        let hasExplicitLight = false;
        let m: RegExpExecArray | null;
        while ((m = nameRegex.exec(_combinedStory)) !== null) {
          const window = _combinedStory.slice(Math.max(0, m.index - 100), m.index + 100);
          if (/\b(white|caucasian|fair[-\s]skinned|pale[-\s]skinned|european[-\s]descent)\b/i.test(window)) {
            hasExplicitLight = true;
            break;
          }
        }
        if (!hasExplicitLight) {
          console.log(`[character-extract] Option B override: ${name} "${skinTone}" → "${_dominantSkin}" (strong story dominant context)`);
          skinTone = _dominantSkin;
        } else {
          console.log(`[character-extract] ${name} kept "${skinTone}" — story has explicit white/Caucasian near their name`);
        }
      }

      // ── Diversity rotation — Henry 2026-06-08 round 2 ──
      // Round 1 (earlier today) only caught "LLM picked fair → rotate". Round 2
      // catches "LLM picked dark with NO story signal → still rotate".
      //
      // Henry's "andrew is a smart boy 8 years old who likes karate" story has
      // ZERO ethnic vocabulary. LLM still defaulted to "dark brown skin" for
      // every character. Round 1 didn't fire because the picked tone wasn't
      // "light". Result: all-Black cast even though story specified nothing.
      //
      // New rule: if `_dominantSkin` is empty (regex matched zero ethnic words
      // across the entire story), the writer didn't intend ANY specific
      // ethnicity. Rotate every character through DIVERSITY_POOL by index.
      // 3-character story → 3 different backgrounds.
      // Henry 2026-06-12 guards on rotation:
      //   1. ANIMALS never get human skin tones — Barker the dog was being stamped
      //      "dark brown skin, African features" by this very block.
      //   2. When the planner provided a Region/Culture, USE IT instead of the
      //      by-index pool — Tobi/Mr. Okafor in a Nigerian story were rotated to
      //      Latina/Caucasian because the story had no LITERAL ethnicity word.
      const noStorySignal = !_dominantSkin;
      const skinIsBlankOrGenericLight = !skinTone || LIGHT_DEFAULT_PATTERN.test(skinTone);
      if (isAnimal) {
        skinTone = "";
        console.log(`[character-extract] ${name} is a ${species} — skipping skin tone / rotation entirely`);
      } else if (noStorySignal && cultureSkin) {
        console.log(`[character-extract] Culture lock (${storyCulture}): ${name} "${skinTone || "blank"}" → "${cultureSkin}"`);
        skinTone = cultureSkin;
      } else if (noStorySignal) {
        const poolPick = DIVERSITY_POOL[i % DIVERSITY_POOL.length];
        console.log(`[character-extract] Diversity rotation (no story signal): ${name} "${skinTone || "blank"}" → "${poolPick}"`);
        skinTone = poolPick;
      } else if (skinIsBlankOrGenericLight && !_dominantIsStrong) {
        // Legacy path: weak signal + LLM-picked-light → rotate (culture first).
        const poolPick = cultureSkin || DIVERSITY_POOL[i % DIVERSITY_POOL.length];
        console.log(`[character-extract] Diversity rotation (weak signal, LLM-picked-light): ${name} → "${poolPick}"`);
        skinTone = poolPick;
      }

      // Generate persistent character ID
      const characterId = generateCharacterId({
        country: country || undefined,
        name,
        age: age || undefined,
        skinTone: skinTone || undefined,
      });

      // Resolve default voice
      const voice = resolveVoice(roleType, gender);
      const isNarrator = roleType === "narrator";

      // Check if character already exists (by name) — skip duplicate creation
      const existing = await prisma.characterVoice.findUnique({
        where: { name },
      });

      if (existing) {
        // Character already registered — use existing record.
        // Henry 2026-06-12: story-truth CORRECTS stale records. Henry's first Tobi
        // run (pre-fix) stored TOBI as adult/Latina and BARKER as human; without
        // this, the wrong rows would win on every re-extract forever.
        // Skin-conflict: stored visual carries a DIFFERENT ethnic family than the
        // story-derived one (e.g. Okafor saved as "fair Caucasian" pre-fix while
        // the name-hint culture says African). Both sides canonicalised through
        // inferSkinToneFromText so they're comparable.
        const existingSkinFamily = inferSkinToneFromText(existing.visualDescription || "");
        const skinConflicts = !!skinTone && !!existingSkinFamily && existingSkinFamily !== skinTone;
        const truthDisagrees =
          (truth.ageClass && existing.age !== truth.ageClass) ||
          (truth.gender && existing.gender !== truth.gender) ||
          (isAnimal && !/\b(animal|NOT human)\b/i.test(existing.visualDescription || "")) ||
          skinConflicts;
        let outVisual = existing.visualDescription || "";
        let outAge = existing.age || age;
        let outGender = existing.gender || gender;
        if (truthDisagrees) {
          outVisual = enrichedVisualDescriptionForTruth(isAnimal, species, age, gender, skinTone, visualDescription);
          outAge = age;
          outGender = gender;
          console.log(`[character-extract] correcting stale record ${name}: age ${existing.age}→${age}, gender ${existing.gender}→${gender}, species=${species}`);
          try {
            await prisma.characterVoice.update({
              where: { id: existing.id },
              data: { age, gender, visualDescription: outVisual || null },
            });
          } catch (updErr) {
            console.warn(`[character-extract] stale-record update failed for ${name}:`, updErr instanceof Error ? updErr.message : updErr);
          }
        }
        createdCharacters.push({
          characterId: existing.characterId || characterId,
          name: existing.name,
          role: existing.role || roleType,
          gender: outGender,
          age: outAge,
          voiceId: existing.voiceId || voice.voiceId,
          voiceName: existing.voiceName || voice.voiceName,
          dbId: existing.id,
          visualDescription: outVisual,
          skinTone: skinTone || "",
          ageRange: outAge,
          colorDescription: skinTone || "",
          species,
        });
        continue;
      }

      // Inject skinTone into visualDescription so image model sees ethnicity/skin first.
      // Only prepend when the description doesn't already mention skin/ethnicity terms,
      // so explicit story-text descriptions aren't duplicated.
      // Henry 2026-06-12: lead with story-truth — species for animals, explicit
      // age phrase for non-adults — BEFORE skin tone. "8-10 year old boy" at the
      // head of the description is what keeps portraits from rendering adults.
      const enrichedVisualDescription = enrichedVisualDescriptionForTruth(isAnimal, species, age, gender, skinTone, visualDescription);

      // Create new CharacterVoice record in database
      const record = await prisma.characterVoice.create({
        data: {
          name,
          characterId,
          gender,
          role: roleType,
          age,
          visualDescription: enrichedVisualDescription || null,
          defaultSpeechStyle: speechStyle,
          isNarrator,
          voiceId: voice.voiceId,
          voiceName: voice.voiceName,
          voiceProvider: "elevenlabs",
          country: country || null,
          personality: personality || null,
          projectAssociation: projectId || null,
          keepSameToggle: true,
        },
      });

      createdCharacters.push({
        characterId,
        name: record.name,
        role: roleType,
        gender,
        age,
        voiceId: voice.voiceId,
        voiceName: voice.voiceName,
        dbId: record.id,
        // NEW: ship the ethnicity/visual data to the client so it can populate React state
        // BEFORE portrait generation runs. Without these, c.skinTone was empty when
        // auto-AI-Read ran and the wrong-portrait colorDescription overrode the story.
        visualDescription: enrichedVisualDescription || "",
        skinTone: skinTone || "",
        ageRange: age,
        colorDescription: skinTone || "",  // mirror so client's buildVisualDescription sees ethnicity
        species,
      });
    }

    // ── Step 3: Return results ─────────────────────────────────
    return NextResponse.json({
      success: true,
      projectId: projectId || null,
      characterCount: createdCharacters.length,
      characters: createdCharacters,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[hybrid/character-extract] Error:", msg);

    // Handle unique constraint violations gracefully
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Duplicate character name detected. Some characters may already exist." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
