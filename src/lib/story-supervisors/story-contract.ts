// Builds a StoryContract from user inputs

import type {
  StoryContract,
  StoryType,
  LanguageLevel,
  EmotionalIntensity,
  SubtitleStyle,
  GenerationMode,
} from "./types";

export interface BuildContractInput {
  storyId: string;
  country: string;
  culture: string;
  storyType: StoryType;
  targetDuration: string;
  sceneDurationSeconds: number;
  languageLevel: LanguageLevel;
  emotionalIntensity: EmotionalIntensity;
  subtitleStyle: SubtitleStyle;
  generationMode: GenerationMode;
  targetAudience: string;
  nameStyle?: string;
}

/**
 * Parses a human-readable duration string into total seconds.
 * Examples: "30-60s" → 45, "1-2 min" → 90, "5 minutes" → 300, "45s" → 45
 */
function parseDurationString(duration: string): number {
  const normalized = duration.toLowerCase().trim();

  // Range format: "30-60s", "1-2 min", "30s-1min"
  const rangeMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:s|sec|second|seconds|m|min|minute|minutes)?\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes)?/
  );
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const unit = (rangeMatch[3] ?? "").toLowerCase();
    const inMinutes =
      unit === "m" || unit === "min" || unit === "minute" || unit === "minutes";
    const lowSec = inMinutes ? low * 60 : low;
    const highSec = inMinutes ? high * 60 : high;
    return Math.round((lowSec + highSec) / 2);
  }

  // Single value with unit: "90s", "2 min", "5 minutes"
  const singleMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes)/
  );
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    const unit = singleMatch[2].toLowerCase();
    if (unit === "m" || unit === "min" || unit === "minute" || unit === "minutes") {
      return Math.round(value * 60);
    }
    return Math.round(value);
  }

  // Bare number — assume seconds
  const bareMatch = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (bareMatch) {
    return Math.round(parseFloat(bareMatch[1]));
  }

  // Default fallback: 60 seconds
  return 60;
}

function resolveAgeRating(storyType: StoryType, emotionalIntensity: EmotionalIntensity): string {
  if (storyType === "children_story") return "G";

  const adultTypes: StoryType[] = ["movie", "documentary", "faith_story"];
  const darkIntensities: EmotionalIntensity[] = ["dark", "very_emotional", "suspense", "action_heavy"];

  if (darkIntensities.includes(emotionalIntensity) || adultTypes.includes(storyType)) {
    return "PG-13";
  }

  return "PG";
}

function resolveDefaultEthnicity(country: string, culture: string): string {
  const countryLower = country.toLowerCase();
  const cultureLower = culture.toLowerCase();

  const africanKeywords = [
    "nigeria", "ghana", "kenya", "south africa", "ethiopia", "tanzania",
    "cameroon", "senegal", "ivory coast", "côte d'ivoire", "uganda", "rwanda",
    "yoruba", "igbo", "hausa", "fulani", "zulu", "ashanti", "kikuyu",
    "nigerian", "ghanaian", "kenyan", "african",
  ];

  const isAfrican = africanKeywords.some(
    (kw) => countryLower.includes(kw) || cultureLower.includes(kw)
  );

  if (isAfrican) {
    if (countryLower.includes("nigeria") || cultureLower.includes("nigerian") ||
        cultureLower.includes("yoruba") || cultureLower.includes("igbo") ||
        cultureLower.includes("hausa")) {
      return "Black Nigerian/African";
    }
    return "Black African";
  }

  if (countryLower.includes("india") || cultureLower.includes("indian")) {
    return "South Asian/Indian";
  }

  if (
    countryLower.includes("china") || countryLower.includes("japan") ||
    countryLower.includes("korea") || cultureLower.includes("asian")
  ) {
    return "East Asian";
  }

  // Generic fallback
  return "matching the story's country and culture";
}

function resolveMusicStyle(storyType: StoryType, emotionalIntensity: EmotionalIntensity): string {
  if (storyType === "children_story") return "playful, whimsical";
  if (storyType === "ad_commercial") return "upbeat, modern";
  if (storyType === "folklore") return "traditional, cultural";
  if (storyType === "faith_story") return "gospel, inspirational";
  if (emotionalIntensity === "funny") return "comedic, light";
  if (emotionalIntensity === "dark") return "dark, cinematic";
  if (emotionalIntensity === "action_heavy") return "intense, percussive";
  if (emotionalIntensity === "cinematic") return "orchestral, cinematic";
  return "ambient, emotional";
}

export function buildStoryContract(input: BuildContractInput): StoryContract {
  const totalDurationSeconds = parseDurationString(input.targetDuration);
  const sceneDurationSeconds = Math.max(5, input.sceneDurationSeconds);
  const estimatedSceneCount = Math.max(1, Math.round(totalDurationSeconds / sceneDurationSeconds));

  const defaultEthnicity = resolveDefaultEthnicity(input.country, input.culture);
  const ageRating = resolveAgeRating(input.storyType, input.emotionalIntensity);
  const musicStyle = resolveMusicStyle(input.storyType, input.emotionalIntensity);

  const isNigerianOrAfrican = defaultEthnicity.toLowerCase().includes("black");

  return {
    storyId: input.storyId,
    country: input.country,
    culture: input.culture,
    storyType: input.storyType,
    totalDurationSeconds,
    sceneDurationSeconds,
    estimatedSceneCount,
    languageLevel: input.languageLevel,
    emotionalIntensity: input.emotionalIntensity,
    subtitleStyle: input.subtitleStyle,
    generationMode: input.generationMode,
    targetAudience: input.targetAudience,
    ageRating,
    defaultCastAssumptions: {
      ethnicity: defaultEthnicity,
      countryContext: input.country,
      allowWhiteCastOnlyIfUserRequests: isNigerianOrAfrican,
    },
    musicStyle,
    nameStyle: input.nameStyle,
  };
}
