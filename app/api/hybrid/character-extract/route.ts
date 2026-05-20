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
- gender: "male" or "female"
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

Age inference rules:
- "child/kid/boy/girl" → "child"
- "teen/teenager/teenage/adolescent" → "teen"
- "young/twenties/early thirties" → "young_adult"
- "thirties/forties/middle-aged" → "adult"
- "elder/old/elderly/grandmother/grandfather/sixties or older" → "elder"
- If truly ambiguous → "adult"

Rules:
- Include EVERY character that speaks or is named
- If a narrator exists, include them as roleType "narrator"
- Do NOT invent characters that are not in the story
- Return ONLY the JSON array, no markdown fences, no explanation

Story:
${story}`;
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
    }> = [];

    for (let i = 0; i < rawCharacters.length; i++) {
      const ch = rawCharacters[i];
      const name = (ch.name || `CHARACTER_${i + 1}`).toUpperCase().trim();
      const roleType = normalizeRole(ch.roleType || "support");
      const gender = ch.gender || "male";
      const age = ch.age || "adult";
      const visualDescription = ch.visualDescription || "";
      const speechStyle = ch.speechStyle || "normal";
      const country = ch.country || "";
      const personality = ch.personality || "";
      // skinTone fallback chain: LLM-extracted → inferred from visualDescription/personality/ethnicity → empty
      const ethnicity = ch.ethnicity || "";
      let skinTone = ch.skinTone || "";
      if (!skinTone) {
        skinTone = inferSkinToneFromText(
          [visualDescription, personality, ethnicity, country].filter(Boolean).join(" "),
        );
      }
      // Final fallback: scan the full story for ethnicity keywords as a last-resort dominant-context inference
      if (!skinTone && typeof expandedStory === "object") {
        const storyText = (expandedStory.fullScript || expandedStory.expandedSummary || expandedStory.idea || "")
          .toString().toLowerCase();
        skinTone = inferSkinToneFromText(storyText);
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
        // Character already registered — use existing record
        createdCharacters.push({
          characterId: existing.characterId || characterId,
          name: existing.name,
          role: existing.role || roleType,
          gender: existing.gender || gender,
          age: existing.age || age,
          voiceId: existing.voiceId || voice.voiceId,
          voiceName: existing.voiceName || voice.voiceName,
          dbId: existing.id,
        });
        continue;
      }

      // Inject skinTone into visualDescription so image model sees ethnicity/skin first.
      // Only prepend when the description doesn't already mention skin/ethnicity terms,
      // so explicit story-text descriptions aren't duplicated.
      const descLower = (visualDescription || "").toLowerCase();
      const alreadyHasSkin = /\b(skin|brown|dark|fair|pale|olive|melanated|complexion|black|white|asian|latina|latino|hispanic|african)\b/.test(descLower);
      const enrichedVisualDescription = (skinTone && !alreadyHasSkin)
        ? `${skinTone}, ${visualDescription}`.replace(/,\s*$/, "")
        : (visualDescription || skinTone || "");

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
