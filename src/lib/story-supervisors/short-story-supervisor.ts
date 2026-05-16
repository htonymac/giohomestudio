// Short Story Supervisor — enforces discipline for short story format

import type { SupervisorResult, ScenePlan, StoryContract } from "./types";

export function runShortStorySupervisor(
  scenes: ScenePlan[],
  storyText: string,
  contract: StoryContract
): SupervisorResult {
  if (contract.storyType !== "short_story") {
    return { passed: true, score: 100, blockingIssues: [], warnings: [], suggestedFixes: [] };
  }

  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const totalDur = contract.totalDurationSeconds;

  // Scene count rules
  if (totalDur <= 60 && scenes.length > 12) {
    blockingIssues.push(`Short story under 60s has ${scenes.length} scenes — max 12 recommended`);
  }
  if (totalDur <= 30 && scenes.length > 6) {
    blockingIssues.push(`30s story has ${scenes.length} scenes — max 6 recommended`);
  }

  // Character count — count unique characters across all scenes
  const allChars = new Set(scenes.flatMap(s => s.characters || []));
  if (totalDur <= 60 && allChars.size > 4) {
    warnings.push(`Short story has ${allChars.size} characters — for 60s, max 3–4 is cleaner`);
  }

  // Word count
  const wordCount = storyText.trim().split(/\s+/).length;
  if (wordCount > 400) {
    warnings.push(`Short story text is ${wordCount} words — may be too detailed for a short story`);
  }

  // Check for clear ending in last scene
  const lastScene = scenes[scenes.length - 1];
  const lastEmotion = lastScene?.emotion?.toLowerCase() || "";
  const goodEndingEmotions = ["resolution", "relief", "joyful", "gratitude", "triumphant", "lesson", "reflection"];
  if (lastScene && !goodEndingEmotions.some(e => lastEmotion.includes(e))) {
    warnings.push(`Short story ending emotion "${lastEmotion}" may not feel conclusive — consider ending on resolution or relief`);
  }

  const score = Math.max(0, 100 - blockingIssues.length * 25 - warnings.length * 8);

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes: [
      ...(blockingIssues.length > 0 ? ["Reduce scene count to match duration", "Limit main characters to 2–3"] : []),
      ...(warnings.length > 0 ? ["Keep story focused and concise", "End with a clear emotional resolution"] : []),
    ],
  };
}
