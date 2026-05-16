// Final Gatekeeper — aggregates all supervisor results into pass/fail report

import type { SupervisorResult, ScenePlan, StoryContract } from "./types";

type ScoreRecord = Record<string, number>;

// Category names mapped to their position in the supervisorResults array
// Order must match how runFullStoryQCPipeline passes them
const CATEGORY_LABELS: string[] = [
  "story_quality",
  "cast_extraction",
  "culture_match",
  "cast_consistency",
  "scene_demarcation",
  "timing",
  "emotion_arc",
  "audio_music",
  "continuity",
  "provider_compat",
];

// Minimum score thresholds per category before blocking (even without explicit blocking issues)
const MINIMUM_SCORES: Record<string, number> = {
  story_quality: 40,
  cast_extraction: 50,
  culture_match: 60,
  cast_consistency: 50,
  scene_demarcation: 60,
  timing: 50,
  emotion_arc: 70,
  audio_music: 70,
  continuity: 60,
  provider_compat: 70,
};

// Weight of each category in the overall score
const CATEGORY_WEIGHTS: Record<string, number> = {
  story_quality: 0.20,
  cast_extraction: 0.10,
  culture_match: 0.15,
  cast_consistency: 0.10,
  scene_demarcation: 0.10,
  timing: 0.10,
  emotion_arc: 0.08,
  audio_music: 0.08,
  continuity: 0.05,
  provider_compat: 0.04,
};

function computeWeightedScore(scores: ScoreRecord): number {
  let total = 0;
  let weightSum = 0;

  for (const [category, score] of Object.entries(scores)) {
    const weight = CATEGORY_WEIGHTS[category] ?? 0.05;
    total += score * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return 0;
  return Math.round(total / weightSum);
}

function classifyReadiness(
  overallScore: number,
  hasBlockingIssues: boolean,
  scores: ScoreRecord
): { ready: boolean; reason: string } {
  if (hasBlockingIssues) {
    return { ready: false, reason: "One or more supervisors raised blocking issues" };
  }

  // Check any category below its minimum threshold
  for (const [category, minScore] of Object.entries(MINIMUM_SCORES)) {
    const actual = scores[category] ?? 100;
    if (actual < minScore) {
      return {
        ready: false,
        reason: `Category "${category}" score ${actual} is below minimum threshold ${minScore}`,
      };
    }
  }

  if (overallScore < 60) {
    return {
      ready: false,
      reason: `Overall quality score ${overallScore} is below minimum threshold of 60`,
    };
  }

  return { ready: true, reason: "All supervisors passed with acceptable scores" };
}

export function runFinalGatekeeper(
  supervisorResults: SupervisorResult[],
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult<{ scores: ScoreRecord; readyForGeneration: boolean; scenes: ScenePlan[] }> {
  const allBlockingIssues: string[] = [];
  const allWarnings: string[] = [];
  const allSuggestedFixes: string[] = [];
  const scores: ScoreRecord = {};

  // Aggregate all supervisor results
  for (let i = 0; i < supervisorResults.length; i++) {
    const result = supervisorResults[i];
    const label = CATEGORY_LABELS[i] ?? `supervisor_${i}`;

    scores[label] = result.score;

    // Collect blocking issues with category prefix
    for (const issue of result.blockingIssues) {
      allBlockingIssues.push(`[${label.toUpperCase()}] ${issue}`);
    }

    // Collect warnings with category prefix (deduplicated)
    for (const warning of result.warnings) {
      const prefixed = `[${label}] ${warning}`;
      if (!allWarnings.includes(prefixed)) {
        allWarnings.push(prefixed);
      }
    }

    // Collect suggested fixes (deduplicated)
    for (const fix of result.suggestedFixes) {
      if (!allSuggestedFixes.includes(fix)) {
        allSuggestedFixes.push(fix);
      }
    }
  }

  // Compute weighted overall score
  const overallScore = computeWeightedScore(scores);

  // Check readiness
  const hasBlockingIssues = allBlockingIssues.length > 0;
  const { ready: readyForGeneration, reason } = classifyReadiness(
    overallScore,
    hasBlockingIssues,
    scores
  );

  // Add readiness note to metadata
  const passed = readyForGeneration;

  // Summary statistics
  const passedSupervisors = supervisorResults.filter((r) => r.passed).length;
  const failedSupervisors = supervisorResults.filter((r) => !r.passed).length;
  const averageScore = supervisorResults.length > 0
    ? Math.round(supervisorResults.reduce((sum, r) => sum + r.score, 0) / supervisorResults.length)
    : 0;

  // Generate category report
  const categoryReport = Object.entries(scores)
    .map(([cat, score]) => {
      const minScore = MINIMUM_SCORES[cat] ?? 0;
      const status = score >= minScore ? "PASS" : "FAIL";
      return `  ${status} ${cat}: ${score}/100 (min: ${minScore})`;
    })
    .join("\n");

  if (!readyForGeneration) {
    allWarnings.unshift(
      `Story NOT ready for generation. Reason: ${reason}`
    );
  }

  return {
    passed,
    score: overallScore,
    blockingIssues: allBlockingIssues,
    warnings: allWarnings,
    suggestedFixes: allSuggestedFixes,
    revisedData: {
      scores,
      readyForGeneration,
      scenes,
    },
    metadata: {
      overallScore,
      readyForGeneration,
      readinessReason: reason,
      passedSupervisors,
      failedSupervisors,
      totalSupervisors: supervisorResults.length,
      averageScore,
      totalBlockingIssues: allBlockingIssues.length,
      totalWarnings: allWarnings.length,
      sceneCount: scenes.length,
      storyId: contract.storyId,
      storyType: contract.storyType,
      country: contract.country,
      categoryReport,
    },
  };
}
