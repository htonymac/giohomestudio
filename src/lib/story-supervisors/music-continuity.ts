// Music Continuity — detects repeated/mismatched music across scenes

import type { SupervisorResult, ScenePlan, StoryContract } from "./types";

export function runMusicContinuityCheck(
  scenes: ScenePlan[],
  _contract: StoryContract
): SupervisorResult {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  // Check for consecutive repeats (3+ scenes same music)
  let repeatCount = 1;
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1].music_cue?.toLowerCase() || "";
    const curr = scenes[i].music_cue?.toLowerCase() || "";
    if (prev && curr && prev === curr) {
      repeatCount++;
      if (repeatCount >= 3) {
        warnings.push(`Music "${curr}" repeats ${repeatCount} scenes in a row (scenes ${i - repeatCount + 2}–${i + 1})`);
      }
    } else {
      repeatCount = 1;
    }
  }

  // Check emotion-music mismatches
  for (const scene of scenes) {
    const music = scene.music_cue?.toLowerCase() || "";
    const emotion = scene.emotion?.toLowerCase() || "";
    if (emotion.includes("sad") && music.includes("fight")) {
      warnings.push(`Scene ${scene.scene_number}: fight music in sad scene`);
    }
    if (emotion.includes("action") && music.includes("piano")) {
      warnings.push(`Scene ${scene.scene_number}: soft piano in action scene — consider higher energy`);
    }
  }

  return {
    passed: blockingIssues.length === 0,
    score: Math.max(0, 100 - warnings.length * 10),
    blockingIssues,
    warnings,
    suggestedFixes: warnings.length > 0
      ? ["Vary music tracks across scenes", "Match music energy to scene emotion"]
      : [],
  };
}
