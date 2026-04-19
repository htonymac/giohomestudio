// GHS Narration Strategy Engine
// Adapts narration style per scene type based on hybrid master workflow rules.

import type { NarrationStrategy } from "./hybrid-types";

const STRATEGY_MAP: Record<string, NarrationStrategy> = {
  "image-led": {
    intensity: "high",
    mode: "descriptive",
    tapering: false,
    reason: "Image scenes need narration to carry the story",
  },
  "video-led": {
    intensity: "low",
    mode: "light",
    tapering: false,
    reason: "Motion carries the story, narration minimal",
  },
  "image-to-video": {
    intensity: "medium",
    mode: "descriptive",
    tapering: true,
    reason: "Narration starts descriptive then reduces as motion takes over",
  },
  "audio-bridge": {
    intensity: "high",
    mode: "transitional",
    tapering: false,
    reason: "Audio bridge needs strong narration for scene transition",
  },
  hybrid: {
    intensity: "medium",
    mode: "descriptive",
    tapering: true,
    reason: "Narration adapts per shot within the scene",
  },
};

const DEFAULT_STRATEGY: NarrationStrategy = {
  intensity: "medium",
  mode: "descriptive",
  tapering: false,
  reason: "Unknown scene type — defaulting to medium descriptive narration",
};

/**
 * Returns the narration strategy for a given scene type.
 * Rules are sourced from the GHS Hybrid Master Workflow document.
 */
export function getNarrationStrategy(sceneType: string): NarrationStrategy {
  return STRATEGY_MAP[sceneType] ?? DEFAULT_STRATEGY;
}
