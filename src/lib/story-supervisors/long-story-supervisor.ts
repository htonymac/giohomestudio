// Long Story Supervisor — checks act structure for long stories and movies

import type { SupervisorResult, ScenePlan, StoryContract } from "./types";

export function runLongStorySupervisor(
  scenes: ScenePlan[],
  _storyText: string,
  contract: StoryContract
): SupervisorResult {
  const isLong = contract.storyType === "long_story" || contract.storyType === "movie";
  if (!isLong) {
    return { passed: true, score: 100, blockingIssues: [], warnings: [], suggestedFixes: [] };
  }

  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const n = scenes.length;

  if (n < 6) {
    blockingIssues.push(`Long story has only ${n} scenes — needs at least 6 for proper act structure`);
  }

  if (n > 0) {
    // Act 1: first ~25% of scenes
    const act1End = Math.floor(n * 0.25);
    // Act 2: middle ~50%
    const act2End = Math.floor(n * 0.75);
    // Act 3: final ~25%

    // Check act 1 — should introduce calm/normal/curious emotions
    const act1Emotions = scenes.slice(0, act1End).map(s => s.emotion?.toLowerCase() || "");
    const act1HasIntro = act1Emotions.some(e =>
      ["calm", "normal", "curious", "informative", "happy"].some(ie => e.includes(ie))
    );
    if (!act1HasIntro && act1Emotions.length > 0) {
      warnings.push("Act 1 (setup) should begin with calm/introductory scenes before conflict");
    }

    // Check act 2 — should have rising tension
    const act2Emotions = scenes.slice(act1End, act2End).map(s => s.emotion?.toLowerCase() || "");
    const act2HasTension = act2Emotions.some(e =>
      ["tension", "concern", "escalation", "crisis", "conflict"].some(te => e.includes(te))
    );
    if (!act2HasTension && act2Emotions.length > 0) {
      warnings.push("Act 2 (conflict) should include tension or escalating emotion");
    }

    // Check act 3 — should resolve
    const act3Emotions = scenes.slice(act2End).map(s => s.emotion?.toLowerCase() || "");
    const act3HasResolution = act3Emotions.some(e =>
      ["resolution", "relief", "triumph", "reflection", "lesson", "gratitude"].some(re => e.includes(re))
    );
    if (!act3HasResolution && act3Emotions.length > 0) {
      warnings.push("Act 3 (resolution) should end with resolution, relief, or reflection");
    }
  }

  const score = Math.max(0, 100 - blockingIssues.length * 30 - warnings.length * 8);

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes: [
      "Structure story in 3 acts: Setup → Conflict → Resolution",
      "Act 1: Introduce characters and world",
      "Act 2: Escalate conflict and stakes",
      "Act 3: Resolve the conflict with emotional payoff",
    ],
  };
}
