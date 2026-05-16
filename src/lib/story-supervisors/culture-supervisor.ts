// Culture Supervisor — validates story and cast match selected country/culture

import type { SupervisorResult, CastBibleEntry, StoryContract } from "./types";

interface CastFix {
  character_id: string;
  fix: string;
}

// Keywords indicating a character is NOT from the African/Nigerian context
const WHITE_ETHNICITY_KEYWORDS = ["white", "caucasian", "blonde", "european", "western"];

// Roles that legitimately justify non-African characters in African stories
const FOREIGNER_ROLES = ["tourist", "foreigner", "expatriate", "international", "missionary", "aid worker", "diplomat"];

// Phrases that feel geographically wrong for Nigerian/African stories
const CLIMATE_MISMATCHES = [
  { pattern: /\bsnow\b/i, label: "snow" },
  { pattern: /\bblizzard\b/i, label: "blizzard" },
  { pattern: /\bice storm\b/i, label: "ice storm" },
  { pattern: /\bavalanche\b/i, label: "avalanche" },
  { pattern: /\bfreezing rain\b/i, label: "freezing rain" },
  { pattern: /\bsledding\b/i, label: "sledding" },
  { pattern: /\bski resort\b/i, label: "ski resort" },
];

const EURO_SETTING_MISMATCHES = [
  { pattern: /\beuropean village\b/i, label: "European village" },
  { pattern: /\bmedieval castle\b/i, label: "medieval castle" },
  { pattern: /\bvikings?\b/i, label: "Vikings" },
  { pattern: /\benglish countryside\b/i, label: "English countryside" },
  { pattern: /\bparis\b/i, label: "Paris (check if relevant)" },
  { pattern: /\bgothic cathedral\b/i, label: "Gothic cathedral" },
  { pattern: /\bvictorian\b/i, label: "Victorian setting" },
];

// Cues expected in Nigerian/African stories — their absence triggers a warning
const CULTURAL_CUE_PATTERNS = [
  /\b(ankara|aso-?oke|iro|buba|agbada|kaftan|wrapper|gele|headtie|dashiki|kente|lappa)\b/i,
  /\b(jollof|suya|pepper soup|egusi|pounded yam|eba|garri|ogbono|akara|moin-?moin|fufu|plantain)\b/i,
  /\b(lagos|abuja|ibadan|kano|enugu|port harcourt|calabar|benin city|onitsha)\b/i,
  /\b(yoruba|igbo|hausa|fulani|efik|tiv|ijaw)\b/i,
  /\b(market|compound|borehole|generator|danfo|okada|molue|kerosene|harmattan|savannah|rainforest)\b/i,
  /\b(naira|kobo)\b/i,
];

function isAfricanOrNigerianContext(country: string, culture: string): boolean {
  const combined = `${country} ${culture}`.toLowerCase();
  const africanKeywords = [
    "nigeria", "nigerian", "yoruba", "igbo", "hausa", "fulani",
    "african", "ghana", "ghanaian", "kenya", "kenyan", "south africa",
    "ethiopia", "cameroon", "senegal",
  ];
  return africanKeywords.some((kw) => combined.includes(kw));
}

function characterIsForeigner(role: string): boolean {
  const roleLower = role.toLowerCase();
  return FOREIGNER_ROLES.some((fr) => roleLower.includes(fr));
}

function ethnicityIsProblematic(ethnicity: string): boolean {
  const lower = ethnicity.toLowerCase();
  return WHITE_ETHNICITY_KEYWORDS.some((kw) => lower.includes(kw));
}

function hasCulturalCues(storyText: string): boolean {
  return CULTURAL_CUE_PATTERNS.some((pattern) => pattern.test(storyText));
}

export function runCultureCheck(
  storyText: string,
  castBible: CastBibleEntry[],
  contract: StoryContract
): SupervisorResult<{ castFixes: CastFix[] }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];
  const castFixes: CastFix[] = [];

  const isAfrican = isAfricanOrNigerianContext(contract.country, contract.culture);

  // ── Cast ethnicity checks ────────────────────────────────────────────────
  if (isAfrican) {
    for (const character of castBible) {
      const isForeigner = characterIsForeigner(character.role);
      const isProblematic = ethnicityIsProblematic(character.ethnicity);

      if (isProblematic && !isForeigner) {
        if (contract.defaultCastAssumptions.allowWhiteCastOnlyIfUserRequests) {
          blockingIssues.push(
            `Character "${character.name}" (${character.character_id}) has ethnicity ` +
              `"${character.ethnicity}" which conflicts with ${contract.country}/${contract.culture} setting. ` +
              `White/Caucasian casting requires explicit user request.`
          );
          castFixes.push({
            character_id: character.character_id,
            fix: `Change ethnicity from "${character.ethnicity}" to "${contract.defaultCastAssumptions.ethnicity}". ` +
              `Update skin_tone to "dark brown to deep black" and hair to natural African styles.`,
          });
          suggestedFixes.push(
            `Update "${character.name}" ethnicity to "${contract.defaultCastAssumptions.ethnicity}".`
          );
        } else {
          warnings.push(
            `Character "${character.name}" ethnicity "${character.ethnicity}" may not match ${contract.country} context.`
          );
        }
      }

      // Check hair consistency — blonde hair is rare in Nigerian/African characters
      if (isAfrican && !isForeigner) {
        const hairLower = character.hair.toLowerCase();
        if (hairLower.includes("blonde") || hairLower.includes("blond")) {
          warnings.push(
            `Character "${character.name}" has blonde hair, which is uncommon for ${contract.country} context. ` +
              `Consider natural black, dark brown, or natural African hair.`
          );
          castFixes.push({
            character_id: character.character_id,
            fix: `Change hair from "${character.hair}" to natural Black/African hair (e.g., "short natural kinky hair" or "long dark braids").`,
          });
        }
      }

      // Clothing check for African context
      if (isAfrican && !isForeigner) {
        const clothingLower = character.clothing.toLowerCase();
        const westernFormal = ["tuxedo", "three-piece suit", "top hat", "tailcoat"];
        const hasWesternOnly = westernFormal.some((w) => clothingLower.includes(w));
        if (hasWesternOnly) {
          warnings.push(
            `Character "${character.name}" clothing "${character.clothing}" may feel out of place for a ${contract.culture} story. ` +
              `Consider African attire options.`
          );
        }
      }
    }
  }

  // ── Story text geographic/climate mismatch checks ─────────────────────────
  if (isAfrican) {
    for (const { pattern, label } of CLIMATE_MISMATCHES) {
      if (pattern.test(storyText)) {
        blockingIssues.push(
          `Story mentions "${label}" which is climatically inconsistent with ${contract.country}. ` +
            `Nigeria/West Africa does not have snow or blizzards.`
        );
        suggestedFixes.push(
          `Replace "${label}" with African weather equivalents: harmattan, rainstorm, tropical heat, dry season.`
        );
      }
    }

    for (const { pattern, label } of EURO_SETTING_MISMATCHES) {
      if (pattern.test(storyText)) {
        warnings.push(
          `Story mentions "${label}" — ensure this is intentional for a ${contract.country} story.`
        );
        suggestedFixes.push(
          `If the story is set in ${contract.country}, replace "${label}" with a local setting equivalent.`
        );
      }
    }

    // ── Cultural cue presence check ────────────────────────────────────────
    if (!hasCulturalCues(storyText)) {
      warnings.push(
        `No recognizable ${contract.culture} cultural cues found in story text. ` +
          `No Nigerian/African food, clothing, city names, language, or environment mentioned.`
      );
      suggestedFixes.push(
        `Add cultural grounding: reference local food (jollof rice, suya), clothing (ankara, agbada), ` +
          `city names (Lagos, Abuja), or environment (market, compound, harmattan).`
      );
    }
  }

  // ── Score calculation ─────────────────────────────────────────────────────
  const totalChecks = isAfrican
    ? castBible.length + CLIMATE_MISMATCHES.length + EURO_SETTING_MISMATCHES.length + 1
    : 1;

  const penaltyPerBlock = 25;
  const penaltyPerWarning = 5;
  const rawScore = Math.max(
    0,
    100 - blockingIssues.length * penaltyPerBlock - warnings.length * penaltyPerWarning
  );

  const passed = blockingIssues.length === 0;

  return {
    passed,
    score: rawScore,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { castFixes },
    metadata: {
      isAfricanContext: isAfrican,
      totalCharactersChecked: castBible.length,
      totalChecks,
    },
  };
}
