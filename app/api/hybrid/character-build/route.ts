// POST /api/hybrid/character-build
// Inline character creation — builds a full character profile from a name + story context.
// Called directly from the Hybrid Planner story tab (no page navigation needed).
//
// Flow:
//   1. Receive: characterName, storyText, artStyle, language
//   2. AI reads story text and finds all mentions/descriptions of that character
//   3. Builds full CharacterIdentity: species, body, colors, clothing, accessories,
//      voice type, intonation, speech style, role, gender, age
//   4. Returns profile — planner shows inline preview, user accepts or regenerates

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

// ── Voice defaults by role + gender ───────────────────────────────────────────
const VOICE_DEFAULTS: Record<string, { voiceId: string; voiceType: string; intonation: string }> = {
  "protagonist-male":   { voiceId: "pNInz6obpgDQGcFmaJgB", voiceType: "mid",     intonation: "energetic" },
  "protagonist-female": { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceType: "mid",     intonation: "calm" },
  "antagonist-male":    { voiceId: "VR6AewLTigWG4xSOukaG", voiceType: "deep",    intonation: "commanding" },
  "antagonist-female":  { voiceId: "VR6AewLTigWG4xSOukaG", voiceType: "raspy",   intonation: "commanding" },
  "narrator":           { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceType: "mid",     intonation: "calm" },
  "elder-male":         { voiceId: "yoZ06aMxZJJ28mfd3POQ", voiceType: "elderly", intonation: "calm" },
  "elder-female":       { voiceId: "yoZ06aMxZJJ28mfd3POQ", voiceType: "soft",    intonation: "calm" },
  "child":              { voiceId: "jBpfuIE2acCO8z3wKNLl", voiceType: "childlike", intonation: "playful" },
  "supporting":         { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceType: "mid",     intonation: "calm" },
  "comic_relief":       { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceType: "mid",     intonation: "playful" },
};

function resolveVoiceDefaults(role: string, gender: string, ageRange: string) {
  const r = role.toLowerCase();
  const g = gender.toLowerCase();
  const a = ageRange.toLowerCase();

  if (a.includes("child") || a.includes("kid")) return VOICE_DEFAULTS["child"];
  if (a.includes("elder") || a.includes("old")) return VOICE_DEFAULTS[`elder-${g}`] || VOICE_DEFAULTS["elder-male"];
  if (r.includes("antag") || r.includes("villain")) return VOICE_DEFAULTS[`antagonist-${g}`] || VOICE_DEFAULTS["antagonist-male"];
  if (r.includes("narrat")) return VOICE_DEFAULTS["narrator"];
  if (r.includes("comic")) return VOICE_DEFAULTS["comic_relief"];
  if (r.includes("support")) return VOICE_DEFAULTS["supporting"];
  // protagonist / hero / lead
  return VOICE_DEFAULTS[`protagonist-${g}`] || VOICE_DEFAULTS["protagonist-male"];
}

// ── LLM prompt ────────────────────────────────────────────────────────────────
function buildCharacterPrompt(
  name: string,
  storyText: string,
  artStyle: string,
  language: string,
  existingCharacters?: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }>
): string {
  const styleHint =
    artStyle === "3d-cinematic" ? "3D animated film style (like Pixar/DreamWorks)" :
    artStyle === "2d-cartoon"   ? "2D cartoon style (bold outlines, flat colours)" :
    artStyle === "anime"        ? "Anime illustration style (expressive, clean linework)" :
    artStyle === "storybook"    ? "Children's storybook illustration style (soft, painterly)" :
    "photorealistic / live-action film style";

  // Build a "taken" block so the AI makes every character visually distinct
  const takenBlock = existingCharacters && existingCharacters.length > 0
    ? `\nALREADY BUILT CHARACTERS — make "${name}" look clearly DIFFERENT from all of these:\n${
        existingCharacters.map(c =>
          `- ${c.name}: species=${c.species || "unknown"}, colour=${c.colorDescription || "unknown"}, gender=${c.gender || "unknown"}`
        ).join("\n")
      }\nDo NOT reuse the same species as any character listed above unless the story explicitly requires it.\n`
    : "";

  return `You are a character design director for an AI film studio.

Story text:
"""
${storyText.slice(0, 3000)}
"""

Art style: ${styleHint}
Language: ${language}
Character to build: "${name}"
${takenBlock}
Read the story carefully and find every mention or description of "${name}".
Build a complete character profile. If the story doesn't specify something, make a creative decision that:
1. Fits the story world and this character's role
2. Makes this character VISUALLY AND EMOTIONALLY DISTINCT from every character listed above

Return ONLY valid JSON (no markdown, no explanation):
{
  "displayName": "${name}",
  "roleType": "protagonist | antagonist | supporting | narrator | elder | child | comic_relief",
  "gender": "male | female | unknown",
  "ageRange": "child | teen | young_adult | adult | elder",
  "species": "human | rabbit | lion | cat | dog | bear | fox | wolf | [other] — what kind of character are they",
  "bodyBuild": "detailed body shape description",
  "colorDescription": "fur/skin/body colour — be specific and DIFFERENT from existing characters",
  "faceFeatures": "face, eyes, nose, ears, any glasses or facial features",
  "clothingDetails": "every item of clothing they wear",
  "accessories": "bags, weapons, props, jewellery — or 'none'",
  "distinctiveFeatures": "the most unique things about this character that MUST appear in every drawing",
  "ageAppearance": "how old they look and their posture",
  "skinTone": "skin or fur tone",
  "wardrobeStyle": "casual | formal | traditional | fantasy | working-class | [other]",
  "speechStyle": "normal | whisper | emotional | commanding | trembling | excited",
  "voiceType": "deep | high | raspy | soft | mid | childlike | elderly",
  "intonation": "calm | energetic | dramatic | whisper | commanding | playful | monotone",
  "emotionProfile": "one sentence — their default emotional state and personality",
  "storyRole": "one sentence — what role they play in this story"
}`;
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { characterName, storyText, artStyle, language, existingCharacters } = body as {
      characterName?: string;
      storyText?: string;
      artStyle?: string;
      language?: string;
      existingCharacters?: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }>;
    };

    if (!characterName || !storyText) {
      return NextResponse.json({ error: "characterName and storyText are required" }, { status: 400 });
    }

    const style = artStyle || "3d-cinematic";
    const lang = language || "English";

    const prompt = buildCharacterPrompt(characterName, storyText, style, lang, existingCharacters);
    const llmResult = await callLLM(
      prompt,
      "You are a character design director. You read story text carefully and build rich, distinct character profiles. You respond ONLY with valid JSON. No markdown. No explanation.",
      { role: "quality" as const, maxTokens: 1400, temperature: 0.6 }
    );

    if (!llmResult.ok) {
      // Fallback — minimal character from name only
      const voiceDefaults = resolveVoiceDefaults("supporting", "unknown", "adult");
      return NextResponse.json({
        ok: true,
        character: {
          displayName: characterName,
          roleType: "supporting",
          gender: "unknown",
          ageRange: "adult",
          species: "human",
          bodyBuild: "average build",
          colorDescription: "not specified",
          faceFeatures: "not specified",
          clothingDetails: "not specified",
          accessories: "none",
          distinctiveFeatures: "not specified",
          ageAppearance: "adult",
          skinTone: "",
          wardrobeStyle: "casual",
          speechStyle: "normal",
          voiceType: voiceDefaults.voiceType,
          intonation: voiceDefaults.intonation,
          voiceId: voiceDefaults.voiceId,
          emotionProfile: "neutral",
          storyRole: "",
          language: lang,
        },
        provider: "fallback",
      });
    }

    // Parse LLM response — strip reasoning tags first, then extract JSON
    let profile: Record<string, string>;
    try {
      const stripped = llmResult.text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
        .trim()
        .replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      profile = JSON.parse(stripped);
    } catch {
      const match = llmResult.text.match(/\{[\s\S]*\}/);
      if (match) {
        try { profile = JSON.parse(match[0]); }
        catch { profile = {}; }
      } else {
        profile = {};
      }
    }

    // Resolve voice defaults if not provided by LLM
    const role = profile.roleType || "supporting";
    const gender = profile.gender || "unknown";
    const age = profile.ageRange || "adult";
    const voiceDefaults = resolveVoiceDefaults(role, gender, age);

    const character = {
      displayName: profile.displayName || characterName,
      roleType: profile.roleType || "supporting",
      gender: profile.gender || "unknown",
      ageRange: profile.ageRange || "adult",
      species: profile.species || "human",
      bodyBuild: profile.bodyBuild || "",
      colorDescription: profile.colorDescription || "",
      faceFeatures: profile.faceFeatures || "",
      clothingDetails: profile.clothingDetails || "",
      accessories: profile.accessories || "none",
      distinctiveFeatures: profile.distinctiveFeatures || "",
      ageAppearance: profile.ageAppearance || "",
      skinTone: profile.skinTone || "",
      wardrobeStyle: profile.wardrobeStyle || "casual",
      speechStyle: profile.speechStyle || "normal",
      voiceType: profile.voiceType || voiceDefaults.voiceType,
      intonation: profile.intonation || voiceDefaults.intonation,
      voiceId: voiceDefaults.voiceId,   // always use role-matched default — user can change later
      emotionProfile: profile.emotionProfile || "",
      storyRole: profile.storyRole || "",
      language: lang,
    };

    return NextResponse.json({
      ok: true,
      character,
      provider: (llmResult as { provider?: string }).provider ?? "llm",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[character-build] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
