// GioHomeStudio — Prompt Enhancer Module
// Enhances raw user input into cinematic, platform-optimized prompts.
// Accepts Studio Control Layer inputs to shape prefix, style, and subject direction.

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

// ── Platform suffix (always social vertical) ─────────────────

const PLATFORM_SUFFIX = "vertical 9:16 format, social media optimized, professional quality";

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
    } = input;

    // AI Auto Mode OFF: minimal enhancement, stay close to raw input
    if (!aiAutoMode) {
      let minimal = rawInput.trim();
      if (visualStyle && VISUAL_STYLE_DESCRIPTOR[visualStyle]) {
        minimal += `, ${VISUAL_STYLE_DESCRIPTOR[visualStyle]}`;
      }
      minimal += `. ${PLATFORM_SUFFIX}.`;
      return {
        enhancedPrompt: minimal,
        suggestions: ["AI auto mode is off — prompt used with minimal enhancement."],
      };
    }

    // ── AI Auto Mode ON: full enhancement ───────────────────

    // 1. Opening prefix (from videoType or default)
    const prefix = (videoType && VIDEO_TYPE_PREFIX[videoType]) ?? DEFAULT_PREFIX;

    // 2. Subject — custom character description takes priority
    let subjectPhrase = "";
    if (subjectType === "custom_character" && customSubjectDescription?.trim()) {
      subjectPhrase = `, featuring ${customSubjectDescription.trim()}`;
    } else if (subjectType && SUBJECT_TYPE_PHRASE[subjectType]) {
      subjectPhrase = `, ${SUBJECT_TYPE_PHRASE[subjectType]}`;
    }

    // 3. Build core prompt
    let enhanced = `${prefix} ${rawInput.trim()}${subjectPhrase}`;

    // 4. Visual style descriptor
    if (visualStyle && VISUAL_STYLE_DESCRIPTOR[visualStyle]) {
      enhanced += `, ${VISUAL_STYLE_DESCRIPTOR[visualStyle]}`;
    } else {
      enhanced += ", dramatic lighting, cinematic color grading, smooth camera motion";
    }

    // 5. Duration hint
    if (targetDuration) {
      enhanced += `, ${targetDuration}-second clip`;
    }

    // 6. Platform suffix
    enhanced += `. ${PLATFORM_SUFFIX}.`;

    return {
      enhancedPrompt: enhanced,
      suggestions: [
        "Add specific emotion or mood to strengthen the prompt",
        "Specify a color palette for more consistent results",
        "Include camera movement direction for better video output",
      ],
    };
  }
}

export const promptEnhancer: IPromptEnhancer = new RuleBasedPromptEnhancer();
