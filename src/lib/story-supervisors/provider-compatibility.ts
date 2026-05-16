// Provider Compatibility — recommends generation method per scene

import type {
  SupervisorResult,
  ScenePlan,
  StoryContract,
  StoryType,
  GenerationMode,
} from "./types";

type ProviderRecommendation = ScenePlan["provider_recommendation"];

interface ProviderRule {
  match: (scene: ScenePlan, contract: StoryContract) => boolean;
  recommendation: ProviderRecommendation;
  reason: string;
  priority: number; // higher = evaluated first
}

// ── Rule definitions ──────────────────────────────────────────────────────────

const PROVIDER_RULES: ProviderRule[] = [
  // Action/fight/chase → always video
  {
    priority: 100,
    match: (scene) => {
      const combined = `${scene.emotion} ${scene.visual_prompt} ${scene.video_prompt}`.toLowerCase();
      return (
        /\b(fight|fighting|chase|chasing|running|explosion|attack|combat|battle|fleeing|pursuit)\b/.test(combined) ||
        scene.emotion.toLowerCase().includes("action") ||
        scene.emotion.toLowerCase().includes("chase")
      );
    },
    recommendation: "video",
    reason: "Action/movement sequence requires video for realistic motion",
  },

  // Crying/confrontation/emotional close-up → video
  {
    priority: 90,
    match: (scene) => {
      const combined = `${scene.emotion} ${scene.visual_prompt} ${scene.camera_style}`.toLowerCase();
      const isEmotionalCloseUp =
        combined.includes("crying") ||
        combined.includes("sobbing") ||
        combined.includes("tears") ||
        combined.includes("confrontation") ||
        (combined.includes("close-up") && combined.includes("emotional"));
      return isEmotionalCloseUp;
    },
    recommendation: "video",
    reason: "Emotional close-up with facial performance requires video capture",
  },

  // Dialogue-heavy without significant motion → image_voiceover
  {
    priority: 80,
    match: (scene) => {
      const hasLongDialogue = Boolean(scene.dialogue) && scene.dialogue.split(/\s+/).length > 15;
      const lowMotion = !scene.video_prompt || scene.video_prompt.toLowerCase().includes("static") ||
        scene.video_prompt.toLowerCase().includes("still");
      const combined = `${scene.visual_prompt} ${scene.emotion}`.toLowerCase();
      const isStaticScene =
        !combined.includes("running") &&
        !combined.includes("moving") &&
        !combined.includes("action") &&
        !combined.includes("fight");
      return hasLongDialogue && (lowMotion || isStaticScene);
    },
    recommendation: "image_voiceover",
    reason: "Dialogue-heavy static scene: use image with voiceover overlay",
  },

  // Very short duration (≤ 5s) + calm → image_plus_motion (cost effective)
  {
    priority: 75,
    match: (scene) => {
      const isMicroScene = scene.duration <= 5;
      const isCalm = ["calm", "peaceful", "neutral", "normal", "wonder", "happiness"].includes(
        scene.emotion.toLowerCase()
      );
      return isMicroScene && isCalm;
    },
    recommendation: "image_plus_motion",
    reason: "Short calm scene: image + subtle motion is cost-effective and sufficient",
  },

  // Children story scenes → image_plus_motion (cost saving per doctrine)
  {
    priority: 70,
    match: (_, contract) => contract.storyType === "children_story",
    recommendation: "image_plus_motion",
    reason: "Children's story: image+motion is appropriate and cost-efficient",
  },

  // Intro/establishing shots → image_plus_motion
  {
    priority: 65,
    match: (scene) => {
      const combined = `${scene.title} ${scene.camera_style} ${scene.emotion}`.toLowerCase();
      return (
        combined.includes("establishing") ||
        combined.includes("wide shot") ||
        combined.includes("intro") ||
        combined.includes("opening") ||
        scene.emotion.toLowerCase() === "calm" ||
        scene.emotion.toLowerCase() === "ordinary_world"
      );
    },
    recommendation: "image_plus_motion",
    reason: "Intro/establishing shot: wide image with parallax motion works well",
  },

  // Narration-heavy (long voiceover, few characters) → image_plus_motion
  {
    priority: 60,
    match: (scene) => {
      const voiceoverWords = scene.voiceover_text?.split(/\s+/).filter((w) => w.length > 0).length ?? 0;
      const fewChars = (scene.characters ?? []).length <= 1;
      return voiceoverWords >= 15 && fewChars;
    },
    recommendation: "image_plus_motion",
    reason: "Narration-heavy scene with minimal cast: image+motion supports voiceover well",
  },

  // Suspense/tension with slow movement → hybrid
  {
    priority: 55,
    match: (scene) => {
      const combined = `${scene.emotion} ${scene.visual_prompt}`.toLowerCase();
      return (
        combined.includes("suspense") ||
        combined.includes("ominous") ||
        (combined.includes("tension") && combined.includes("slow"))
      );
    },
    recommendation: "hybrid",
    reason: "Suspense scene: hybrid image+AI motion creates effective slow tension",
  },

  // Ad commercial → always video for professional look
  {
    priority: 50,
    match: (_, contract) =>
      contract.storyType === "ad_commercial" || contract.generationMode === "full_video",
    recommendation: "video",
    reason: "Commercial/full video mode requires video generation for professional quality",
  },

  // Faith/prayer scenes → image_plus_motion (sacred, still composition)
  {
    priority: 45,
    match: (scene) => {
      const emotionLower = scene.emotion.toLowerCase();
      return (
        emotionLower.includes("prayer") ||
        emotionLower.includes("faith") ||
        emotionLower.includes("miracle") ||
        emotionLower.includes("gratitude") ||
        emotionLower.includes("testimony")
      );
    },
    recommendation: "image_plus_motion",
    reason: "Faith/prayer scene: still composition with subtle motion captures spiritual gravity",
  },

  // Resolution/closure → image_plus_motion (peaceful still)
  {
    priority: 40,
    match: (scene) => {
      const emotionLower = scene.emotion.toLowerCase();
      return (
        emotionLower.includes("resolution") ||
        emotionLower.includes("peace") ||
        emotionLower.includes("conclusion") ||
        emotionLower.includes("lesson") ||
        emotionLower.includes("legacy")
      );
    },
    recommendation: "image_plus_motion",
    reason: "Resolution scene: peaceful still composition with subtle motion",
  },
];

function applyDefaultRule(scene: ScenePlan): {
  recommendation: ProviderRecommendation;
  reason: string;
} {
  // Default by duration
  if (scene.duration <= 5) {
    return {
      recommendation: "image_plus_motion",
      reason: "Default short scene: image+motion is most efficient",
    };
  }
  if (scene.duration <= 10) {
    return {
      recommendation: "image_plus_motion",
      reason: "Default medium scene: image+motion balances quality and cost",
    };
  }
  return {
    recommendation: "hybrid",
    reason: "Default longer scene: hybrid approach recommended",
  };
}

// ── Generation mode overrides ─────────────────────────────────────────────────

function applyGenerationModeOverride(
  recommendation: ProviderRecommendation,
  generationMode: GenerationMode
): ProviderRecommendation {
  switch (generationMode) {
    case "full_video":
      return "video";
    case "image_storybook":
      return "image_voiceover";
    case "voiceover_story":
      return "image_voiceover";
    case "children_song":
      return "image_plus_motion";
    case "hybrid":
      return recommendation; // Keep rule-based recommendation
    default:
      return recommendation;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runProviderCompatibilityCheck(
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult<{ updatedScenes: ScenePlan[] }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  if (scenes.length === 0) {
    return {
      passed: false,
      score: 0,
      blockingIssues: ["No scenes to check provider compatibility on."],
      warnings: [],
      suggestedFixes: [],
      revisedData: { updatedScenes: [] },
    };
  }

  // Sort rules by priority (highest first)
  const sortedRules = [...PROVIDER_RULES].sort((a, b) => b.priority - a.priority);

  const providerCounts: Record<ProviderRecommendation, number> = {
    image_plus_motion: 0,
    video: 0,
    image_voiceover: 0,
    hybrid: 0,
  };

  const updatedScenes: ScenePlan[] = scenes.map((scene) => {
    // Find first matching rule
    const matchedRule = sortedRules.find((rule) => rule.match(scene, contract));

    let recommendation: ProviderRecommendation;
    let reason: string;

    if (matchedRule) {
      recommendation = matchedRule.recommendation;
      reason = matchedRule.reason;
    } else {
      const defaultResult = applyDefaultRule(scene);
      recommendation = defaultResult.recommendation;
      reason = defaultResult.reason;
    }

    // Apply generation mode override
    const finalRecommendation = applyGenerationModeOverride(recommendation, contract.generationMode);
    if (finalRecommendation !== recommendation) {
      reason = `[Mode override: ${contract.generationMode}] ${reason}`;
    }

    providerCounts[finalRecommendation]++;

    return {
      ...scene,
      provider_recommendation: finalRecommendation,
      provider_reason: reason,
    };
  });

  // Validate distribution — warn if all scenes use expensive video
  const videoCount = providerCounts["video"];
  const totalScenes = scenes.length;
  const videoRatio = videoCount / totalScenes;

  if (videoRatio > 0.8 && totalScenes > 5) {
    warnings.push(
      `${videoCount}/${totalScenes} scenes (${Math.round(videoRatio * 100)}%) recommended as "video". ` +
        `This may be expensive. Consider switching some calm scenes to "image_plus_motion".`
    );
    suggestedFixes.push(
      `Review scenes with emotion "calm", "resolution", "faith" — these can use image_plus_motion instead of video.`
    );
  }

  // Warn if children story has too many video scenes
  if (contract.storyType === "children_story" && videoCount > 0) {
    warnings.push(
      `${videoCount} video scenes in a children's story. Consider using image_plus_motion for cost efficiency.`
    );
  }

  // Check mode compatibility
  if (contract.generationMode === "image_storybook" && videoCount > 0) {
    warnings.push(
      `Generation mode is "image_storybook" but ${videoCount} scenes were initially recommended as video. ` +
        `These have been overridden to image_voiceover.`
    );
  }

  const score =
    blockingIssues.length > 0
      ? 0
      : warnings.length > 2
      ? 75
      : warnings.length > 0
      ? 90
      : 100;

  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { updatedScenes },
    metadata: {
      totalScenes,
      providerCounts,
      generationMode: contract.generationMode,
      videoRatio: Math.round(videoRatio * 100),
    },
  };
}
