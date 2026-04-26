// GioHomeStudio — Prompt Enhancer Module
// Enhances raw user input into cinematic, platform-optimized prompts.
// Accepts Studio Control Layer inputs to shape prefix, style, and subject direction.
// Identity signals (casting, culture) are injected FIRST so AI models don't default
// to generic Western appearances.

import type { IPromptEnhancer, PromptEnhancerInput, PromptEnhancerOutput } from "@/types/providers";

// ── Video type → opening prefix ─────────────────────────────

const VIDEO_TYPE_PREFIX: Record<string, string> = {
  cinematic:    "Cinematic slow motion shot of",
  ad_promo:     "Professional commercial advertisement featuring",
  realistic:    "Photorealistic documentary-style footage of",
  animation:    "Animated sequence showing",
  storytelling: "Narrative film scene depicting",
  social_short: "Viral social media short clip of",
};

const DEFAULT_PREFIX = "Cinematic sequence showing";

// ── Visual style → descriptor phrase ────────────────────────

const VISUAL_STYLE_DESCRIPTOR: Record<string, string> = {
  photorealistic:   "photorealistic rendering, hyperdetailed, ultra-HD quality",
  stylized:         "stylized artistic direction, painterly composition",
  anime:            "anime art style, hand-drawn animation quality",
  "3d":             "3D rendered CGI, volumetric lighting, ray-traced reflections",
  cinematic_dark:   "cinematic dark atmosphere, deep shadows, noir lighting",
  bright_commercial:"bright vibrant colors, commercial photography quality, clean studio look",
};

// ── Subject type → subject direction phrase ──────────────────

const SUBJECT_TYPE_PHRASE: Record<string, string> = {
  human:            "with a human subject as the focal point",
  animal:           "with an animal as the central subject",
  product:          "product showcase, clean and precise presentation",
  scene_only:       "wide establishing shot, no primary human or animal subject",
};

// ── Identity / casting descriptors ───────────────────────────
// These are injected as the SUBJECT FIRST — before the raw input — so AI models
// receive an explicit casting signal and don't default to generic western appearances.

const ETHNICITY_DESCRIPTOR: Record<string, string> = {
  african:  "Black African",
  black:    "Black",
  white:    "White Caucasian",
  asian:    "East Asian",
  arab:     "Arab Middle Eastern",
  mixed:    "mixed-race",
};

const GENDER_DESCRIPTOR: Record<string, string> = {
  male:         "man",
  female:       "woman",
  nonbinary:    "person",
  mixed_gender: "people",
};

const AGE_DESCRIPTOR: Record<string, string> = {
  child:       "young child",
  teen:        "teenager",
  young_adult: "young adult",
  adult:       "adult",
  senior:      "elderly person",
};

const COUNT_DESCRIPTOR: Record<string, string> = {
  solo:  "a single",
  duo:   "two",
  group: "a group of",
  crowd: "a large crowd of",
};

// Culture context → environment/setting signals injected after the subject
const CULTURE_CONTEXT_SIGNAL: Record<string, string> = {
  african:  "African setting, authentic African environment and cultural details",
  arab:     "Middle Eastern/Arab setting, authentic cultural environment",
  asian:    "Asian cultural setting, authentic cultural environment",
  latin:    "Latin American setting, authentic cultural environment",
  western:  "Western environment and aesthetic",
  global:   "universal environment, globally relatable setting",
};

// ── Platform suffix (always social vertical) ─────────────────

const PLATFORM_SUFFIX = "vertical 9:16 format, social media optimized, professional quality";

// ── Narration script builder ──────────────────────────────────
// Produces natural spoken text from the raw input — no camera directions,
// no cinematic jargon. This is what ElevenLabs actually speaks aloud.

function buildNarrationScript(
  rawInput: string,
  storyContext?: string,
): string {
  let script = rawInput.trim();

  // If this is a continuation, prefix with a light narrative bridge
  if (storyContext) {
    // Keep the context brief — just enough to ground the reader/listener
    const contextBrief = storyContext.length > 200
      ? storyContext.slice(0, 197) + "…"
      : storyContext;
    script = `${contextBrief} ${script}`;
  }

  script = script.charAt(0).toUpperCase() + script.slice(1);
  if (!/[.!?]$/.test(script)) script += ".";

  return script;
}

// ── Build identity descriptor string ─────────────────────────

function buildIdentityDescriptor(
  castingEthnicity?: string,
  castingGender?: string,
  castingAge?: string,
  castingCount?: string,
): string | null {
  // Only build if at least one casting signal is provided
  if (!castingEthnicity && !castingGender && !castingAge && !castingCount) return null;

  const count = castingCount ? COUNT_DESCRIPTOR[castingCount] ?? "" : "a";
  const age   = castingAge   ? AGE_DESCRIPTOR[castingAge] ?? ""    : "";
  const eth   = castingEthnicity ? ETHNICITY_DESCRIPTOR[castingEthnicity] ?? castingEthnicity : "";
  const gender = castingGender  ? GENDER_DESCRIPTOR[castingGender] ?? castingGender : "person";

  // Build: "[count] [age] [ethnicity] [gender]", collapsing empty parts
  const parts = [count, age, eth, gender].filter(Boolean);
  return parts.join(" ");
}

// ── Enhancer ─────────────────────────────────────────────────

class RuleBasedPromptEnhancer implements IPromptEnhancer {
  async enhance(input: PromptEnhancerInput): Promise<PromptEnhancerOutput> {
    const {
      rawInput,
      targetDuration,
      videoType,
      visualStyle,
      subjectType,
      customSubjectDescription,
      aiAutoMode = true,
      castingEthnicity,
      castingGender,
      castingAge,
      castingCount,
      cultureContext,
      referenceImageUrl,
      storyContext,
    } = input;

    // AI Auto Mode OFF: minimal enhancement, stay close to raw input
    if (!aiAutoMode) {
      let minimal = rawInput.trim();
      if (storyContext) minimal = `Continuing — ${minimal}`;
      if (visualStyle && VISUAL_STYLE_DESCRIPTOR[visualStyle]) {
        minimal += `, ${VISUAL_STYLE_DESCRIPTOR[visualStyle]}`;
      }
      minimal += `. ${PLATFORM_SUFFIX}.`;
      return {
        enhancedPrompt: minimal,
        narrationScript: buildNarrationScript(rawInput, storyContext),
        suggestions: ["AI auto mode is off — prompt used with minimal enhancement."],
      };
    }

    // ── AI Auto Mode ON: full enhancement ───────────────────

    // 1. Opening prefix (from videoType or default)
    const prefix = (videoType && VIDEO_TYPE_PREFIX[videoType]) ?? DEFAULT_PREFIX;

    // 2. Identity descriptor — built FIRST so it becomes the subject of the sentence.
    //    This prevents AI models from defaulting to generic western appearances.
    const identityDesc = buildIdentityDescriptor(
      castingEthnicity,
      castingGender,
      castingAge,
      castingCount,
    );

    // 3. Subject phrase
    //    Priority: custom_character description > identity descriptor > subject type phrase
    let subjectPhrase = "";
    if (subjectType === "custom_character" && customSubjectDescription?.trim()) {
      subjectPhrase = `${customSubjectDescription.trim()} — `;
    } else if (identityDesc) {
      subjectPhrase = `${identityDesc} — `;
    } else if (subjectType && SUBJECT_TYPE_PHRASE[subjectType]) {
      subjectPhrase = "";  // will be appended later as a modifier instead
    }

    // 4. Build core prompt: prefix + subject + raw input
    // When story context is present, insert a continuity signal before the raw input
    const continuityPrefix = storyContext
      ? `continuing the story — `
      : "";
    let enhanced = `${prefix} ${subjectPhrase}${continuityPrefix}${rawInput.trim()}`;

    // 5. Subject type modifier (when not already handled by identity/custom)
    if (!subjectPhrase && subjectType && SUBJECT_TYPE_PHRASE[subjectType]) {
      enhanced += `, ${SUBJECT_TYPE_PHRASE[subjectType]}`;
    }

    // 6. Culture context signal — sets the environment/world
    if (cultureContext && CULTURE_CONTEXT_SIGNAL[cultureContext]) {
      enhanced += `, ${CULTURE_CONTEXT_SIGNAL[cultureContext]}`;
    }

    // 7. Reference image note (prompt hint, not a URL injection)
    if (referenceImageUrl?.trim()) {
      enhanced += `, consistent with reference visual style`;
    }

    // 8. Visual style descriptor
    if (visualStyle && VISUAL_STYLE_DESCRIPTOR[visualStyle]) {
      enhanced += `, ${VISUAL_STYLE_DESCRIPTOR[visualStyle]}`;
    } else {
      enhanced += ", dramatic lighting, cinematic color grading, smooth camera motion";
    }

    // 9. Duration hint
    if (targetDuration) {
      enhanced += `, ${targetDuration}-second clip`;
    }

    // 10. Platform suffix
    enhanced += `. ${PLATFORM_SUFFIX}.`;

    return {
      enhancedPrompt: enhanced,
      narrationScript: buildNarrationScript(rawInput, storyContext),
      suggestions: [
        "Add specific emotion or mood to strengthen the prompt",
        "Specify a color palette for more consistent results",
        "Include camera movement direction for better video output",
      ],
    };
  }
}

export const promptEnhancer: IPromptEnhancer = new RuleBasedPromptEnhancer();
