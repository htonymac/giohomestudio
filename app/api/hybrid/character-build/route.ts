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

// BUG-02 Fix C: helper to detect human role from story context or explicit hints
function isHumanRole(storyText: string, name: string): boolean {
  const lower = storyText.toLowerCase();
  const nameLower = name.toLowerCase();
  // Explicit human indicators near the character name
  const humanKeywords = ["human", "person", "man", "woman", "boy", "girl", "teacher", "student",
    "doctor", "officer", "farmer", "priest", "king", "queen", "prince", "princess",
    "soldier", "warrior", "merchant", "scientist", "engineer", "nurse"];
  for (const kw of humanKeywords) {
    if (lower.includes(`${nameLower} ${kw}`) || lower.includes(`${kw} ${nameLower}`) ||
        lower.includes(`${nameLower} is a ${kw}`) || lower.includes(`${nameLower} was a ${kw}`)) {
      return true;
    }
  }
  // No clear animal indicators near name
  const animalKeywords = ["rabbit", "lion", "cat", "dog", "fox", "wolf", "bear", "tiger",
    "elephant", "monkey", "horse", "duck", "pig", "owl", "frog"];
  for (const kw of animalKeywords) {
    if (lower.includes(`${nameLower} the ${kw}`) || lower.includes(`${kw} named ${nameLower}`) ||
        lower.includes(`${nameLower} is a ${kw}`) || lower.includes(`${nameLower} was a ${kw}`)) {
      return false; // explicitly an animal
    }
  }
  // Default: if no explicit animal cue, lean human
  return true;
}

function buildCharacterPrompt(
  name: string,
  storyText: string,
  artStyle: string,
  language: string,
  existingCharacters?: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }>,
  roleHint?: string
): string {
  const styleHint =
    artStyle === "realistic"    ? "ultra-realistic photographic style, real person aesthetic, NO cartoon or CGI" :
    artStyle === "nollywood"    ? "Nollywood film style, realistic Nigerian cinema, warm natural lighting, real person" :
    artStyle === "3d-cinematic" ? "3D animated film style (Pixar/DreamWorks quality)" :
    artStyle === "2d-cartoon"   ? "2D cartoon style (bold outlines, flat colours)" :
    artStyle === "anime"        ? "Anime illustration style (expressive, clean linework)" :
    artStyle === "storybook"    ? "Children's storybook illustration style (soft, painterly)" :
    artStyle === "comic"        ? "comic book illustration style (bold ink, graphic novel)" :
    "3D animated film style (Pixar/DreamWorks quality)";

  // Build a "taken" block so the AI knows which characters already exist.
  // Henry 2026-05-30: was "make DIFFERENT from all of these" — that wording pushed the
  // LLM toward stereotype-contrast (if existing char is "tall lean", new char defaults
  // to "short stocky") instead of grounding in the story. Now we just show the existing
  // cast for awareness and ask the LLM to ground "${name}" in the story text.
  const takenBlock = existingCharacters && existingCharacters.length > 0
    ? `\nEXISTING CAST (for reference — do NOT copy traits, but do NOT force stylistic contrast either):\n${
        existingCharacters.map(c =>
          `- ${c.name}: species=${c.species || "unknown"}, colour=${c.colorDescription || "unknown"}, gender=${c.gender || "unknown"}`
        ).join("\n")
      }\nBuild "${name}" from what the STORY TEXT says about them — physical details, role, age, ethnicity, wardrobe. Each character is who the story says they are; visual distinctness comes from grounded story detail, not artificial contrast against the existing cast.\n`
    : "";

  // BUG-02 Fix C: detect if character is human from story context or explicit roleHint
  const likelyHuman = roleHint === "human" || isHumanRole(storyText, name);

  // Species options: exclude bear for human characters and for any non-explicit-animal role.
  // BUG-02 fix: removed "bear" from non-human option list entirely — bear only valid when
  // story text EXPLICITLY names the character as a bear and isHumanRole() returns false.
  const speciesOptions = likelyHuman
    ? `"human" — this character is human. Do NOT use bear, animal, or anthropomorphic anatomy.`
    : `"human | rabbit | lion | cat | dog | fox | wolf | [other]" — pick the species that the story explicitly calls out. Do NOT default to bear unless the story text EXPLICITLY names this character as a bear.`;

  // Human guard block — injected when character appears to be human
  const humanGuard = likelyHuman
    ? `\nCRITICAL: "${name}" appears to be a human character. Generate a FULLY HUMAN character profile:
- species MUST be "human"
- Do NOT add bear features, paws, snout, fur, or any animal anatomy
- Do NOT use anthropomorphic or cartoon animal traits
- skin tone should be a realistic human skin tone
- face features should be human face features only\n`
    : "";

  return `You are a character design director for an AI film studio.

Story text:
"""
${storyText.slice(0, 3000)}
"""

Art style: ${styleHint}
Language: ${language}
Character to build: "${name}"
${takenBlock}${humanGuard}
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
  "species": ${speciesOptions},
  "bodyBuild": "detailed body shape description",
  "colorDescription": "fur/skin/body colour — be specific and grounded in the story text (not artificially contrasted with other characters)",
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
    const { characterName, storyText, artStyle, language, existingCharacters, childSafe, role } = body as {
      characterName?: string;
      storyText?: string;
      artStyle?: string;
      language?: string;
      existingCharacters?: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }>;
      childSafe?: boolean;   // Fix E: when true, enforce human default + child-safe language
      role?: string;         // Fix C: explicit role hint from caller ("human" enforces human anatomy)
    };

    if (!characterName || !storyText) {
      return NextResponse.json({ error: "characterName and storyText are required" }, { status: 400 });
    }

    const style = artStyle || "3d-cinematic";
    const lang = language || "English";

    const prompt = buildCharacterPrompt(characterName, storyText, style, lang, existingCharacters, role);
    // BUG-02 Fix C+E: system prompt guard — prevents LLM defaulting to bear/animal anatomy for humans
    // childSafe + explicit role="human" both strengthen the human-anatomy enforcement
    const isExplicitHuman = role === "human" || childSafe === true;
    const humanEnforcement = isExplicitHuman
      ? "ABSOLUTE RULE: This character is HUMAN. " +
        "species MUST be 'human'. No bear, no animal anatomy, no fur, no snout, no paws, no anthropomorphic traits. " +
        "Generate a realistic human person with human skin, human face, and human clothing. "
      : "CRITICAL RULE: If the character is described as human, or there is no explicit animal cue in the story, " +
        "generate a FULLY HUMAN character. Do NOT use bear features, animal anatomy, fur, snout, paws, " +
        "or any anthropomorphic characteristics unless the story text EXPLICITLY states the character is an animal. ";
    const systemPrompt =
      "You are a character design director. You read story text carefully and build rich, distinct character profiles. " +
      "You respond ONLY with valid JSON. No markdown. No explanation. " +
      humanEnforcement;
    const llmResult = await callLLM(
      prompt,
      systemPrompt,
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
    const resolvedRole = profile.roleType || "supporting";
    const gender = profile.gender || "unknown";
    const age = profile.ageRange || "adult";
    const voiceDefaults = resolveVoiceDefaults(resolvedRole, gender, age);

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
