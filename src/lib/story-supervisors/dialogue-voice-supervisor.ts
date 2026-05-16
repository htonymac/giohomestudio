// Dialogue & Voice Supervisor — validates dialogue fits duration and voices match characters

import type { SupervisorResult, ScenePlan, CastBibleEntry, StoryContract } from "./types";

function wordsPerSecond(durationSeconds: number): number {
  return Math.round(durationSeconds * 2.4);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function runDialogueVoiceCheck(
  scenes: ScenePlan[],
  castBible: CastBibleEntry[],
  _contract: StoryContract
): SupervisorResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  for (const scene of scenes) {
    const maxWords = wordsPerSecond(scene.duration);

    // Check voiceover length
    const voiceoverWords = countWords(scene.voiceover_text || "");
    if (voiceoverWords > maxWords + 5) {
      blockingIssues.push(
        `Scene ${scene.scene_number}: voiceover ${voiceoverWords} words exceeds ${maxWords} max for ${scene.duration}s`
      );
      suggestedFixes.push(`Scene ${scene.scene_number}: reduce voiceover to ${maxWords} words`);
    }

    // Check dialogue length
    const dialogueWords = countWords(scene.dialogue || "");
    if (dialogueWords > maxWords) {
      warnings.push(`Scene ${scene.scene_number}: dialogue ${dialogueWords} words may be long for ${scene.duration}s`);
    }

    // Check characters in scene have voice assignments in Cast Bible
    for (const charId of scene.characters || []) {
      const castEntry = castBible.find(c => c.character_id === charId);
      if (!castEntry) {
        warnings.push(`Scene ${scene.scene_number}: character "${charId}" not in Cast Bible`);
      }
    }
  }

  // Check for multiple narrators talking simultaneously (heuristic: same scene has voiceover + dialogue from different chars)
  for (const scene of scenes) {
    if (scene.voiceover_text && scene.dialogue && scene.characters && scene.characters.length > 1) {
      warnings.push(`Scene ${scene.scene_number}: narrator + dialogue overlap — ensure they don't play simultaneously`);
    }
  }

  const score = Math.max(0, 100 - blockingIssues.length * 20 - warnings.length * 5);

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
  };
}
