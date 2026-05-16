// Subtitle Style Supervisor — validates subtitle settings match story type

import type { SupervisorResult, ScenePlan, StoryContract, SubtitleStyle } from "./types";

const STYLE_RULES: Record<SubtitleStyle, { maxWordsPerLine: number; animation: string }> = {
  normal_movie: { maxWordsPerLine: 10, animation: "none" },
  children_story: { maxWordsPerLine: 6, animation: "bounce" },
  karaoke: { maxWordsPerLine: 8, animation: "word_highlight" },
  action: { maxWordsPerLine: 8, animation: "fast_fade" },
  emotional: { maxWordsPerLine: 10, animation: "slow_fade" },
  educational: { maxWordsPerLine: 8, animation: "keyword_highlight" },
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function runSubtitleStyleCheck(
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult<{ updatedScenes: ScenePlan[] }> {
  const warnings: string[] = [];
  const updatedScenes: ScenePlan[] = [];

  const style = contract.subtitleStyle;
  const rules = STYLE_RULES[style] ?? STYLE_RULES.normal_movie;

  for (const scene of scenes) {
    const subtitleWords = countWords(scene.subtitle_text || "");
    let updated = { ...scene, subtitle_style: style };

    if (subtitleWords > rules.maxWordsPerLine * 2) {
      warnings.push(
        `Scene ${scene.scene_number}: subtitle "${(scene.subtitle_text || "").slice(0, 60)}…" may be too long for ${style} style`
      );
    }

    // Children story: ensure subtitle style matches
    if (contract.storyType === "children_story" && style !== "children_story") {
      warnings.push(`Scene ${scene.scene_number}: children story should use children_story subtitle style`);
    }

    updatedScenes.push(updated);
  }

  return {
    passed: true,
    score: Math.max(60, 100 - warnings.length * 10),
    blockingIssues: [],
    warnings,
    suggestedFixes: warnings.length > 0 ? [`Use ${style} subtitle style consistently`, "Keep subtitle text concise"] : [],
    revisedData: { updatedScenes },
  };
}
