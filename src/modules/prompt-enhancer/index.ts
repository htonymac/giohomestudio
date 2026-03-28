// GioHomeStudio — Prompt Enhancer Module
// Enhances raw user input into cinematic, platform-optimized prompts.
// Currently uses a rule-based approach. Swap with Claude API / local LLM in Phase 2.

import type { IPromptEnhancer, PromptEnhancerInput, PromptEnhancerOutput } from "@/types/providers";

const CINEMATIC_PREFIXES = [
  "Cinematic slow motion shot of",
  "Epic wide-angle cinematic sequence showing",
  "Dramatic close-up cinematic scene of",
  "High-quality photorealistic render of",
];

const PLATFORM_SUFFIXES: Record<string, string> = {
  default: "vertical format, high detail, professional quality.",
  reels: "vertical 9:16 format, Instagram Reels optimized, fast-paced editing.",
  shorts: "vertical 9:16 format, YouTube Shorts optimized, punchy pacing.",
  tiktok: "vertical 9:16 format, TikTok optimized, trend-aware composition.",
};

class RuleBasedPromptEnhancer implements IPromptEnhancer {
  async enhance(input: PromptEnhancerInput): Promise<PromptEnhancerOutput> {
    const { rawInput, targetDuration } = input;

    // Pick a cinematic prefix
    const prefix = CINEMATIC_PREFIXES[Math.floor(Math.random() * CINEMATIC_PREFIXES.length)];

    // Build base enhanced prompt
    let enhanced = `${prefix} ${rawInput.trim()}`;

    // Add cinematic descriptors
    enhanced += ", dramatic lighting, cinematic color grading, smooth camera motion";

    // Add duration hint
    if (targetDuration) {
      enhanced += `, ${targetDuration}-second duration`;
    }

    // Add platform suffix
    enhanced += `. ${PLATFORM_SUFFIXES.reels}`;

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

// Singleton export
export const promptEnhancer: IPromptEnhancer = new RuleBasedPromptEnhancer();
