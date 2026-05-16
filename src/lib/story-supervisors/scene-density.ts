// Scene Density Check — validates each scene has achievable content for its duration

import type { SupervisorResult, ScenePlan, StoryContract } from "./types";

interface DensityRule {
  maxDuration: number;
  maxWords: number;
  maxCharacters: number;
  label: string;
}

const DENSITY_RULES: DensityRule[] = [
  { maxDuration: 5, maxWords: 12, maxCharacters: 2, label: "5s micro-scene" },
  { maxDuration: 8, maxWords: 20, maxCharacters: 3, label: "8s short scene" },
  { maxDuration: 10, maxWords: 25, maxCharacters: 4, label: "10s scene" },
  { maxDuration: 15, maxWords: 38, maxCharacters: 5, label: "15s scene" },
  { maxDuration: 20, maxWords: 50, maxCharacters: 6, label: "20s scene" },
  { maxDuration: 30, maxWords: 75, maxCharacters: 8, label: "30s scene" },
  { maxDuration: Infinity, maxWords: 130, maxCharacters: 10, label: "long scene" },
];

function getRuleForDuration(duration: number): DensityRule {
  return DENSITY_RULES.find((r) => duration <= r.maxDuration) ?? DENSITY_RULES[DENSITY_RULES.length - 1];
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function countCommas(text: string): number {
  return (text.match(/,/g) ?? []).length;
}

function detectMultiThenChain(text: string): number {
  // Count "then" occurrences beyond the first
  const matches = text.match(/\bthen\b/gi) ?? [];
  return Math.max(0, matches.length - 1);
}

function detectComplexActionSequence(text: string): boolean {
  // "then X then Y then Z" — 2+ chained "then"
  const thenChain = detectMultiThenChain(text);
  if (thenChain >= 2) return true;

  // Coordinating action verbs: "runs and jumps and screams and falls"
  const andChain = (text.match(/\band\b/gi) ?? []).length;
  if (andChain >= 4) return true;

  return false;
}

function detectOverlyComplexPrompt(text: string, duration: number): string[] {
  const issues: string[] = [];
  const commas = countCommas(text);

  // For short scenes, many commas = too complex
  const commaThreshold = duration <= 5 ? 4 : duration <= 10 ? 6 : 8;
  if (commas > commaThreshold) {
    issues.push(
      `Prompt has ${commas} commas (threshold ${commaThreshold} for ${duration}s scene) — too complex for single image/video frame.`
    );
  }

  // "then ... then" multi-action in prompts
  const thenChains = detectMultiThenChain(text);
  if (thenChains >= 1) {
    issues.push(
      `Prompt contains ${thenChains + 1} "then" chains — should be a single visual moment, not a sequence.`
    );
  }

  return issues;
}

export function runSceneDensityCheck(
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  let totalChecks = 0;
  let checksPassed = 0;

  for (const scene of scenes) {
    const duration = scene.duration ?? contract.sceneDurationSeconds;
    const rule = getRuleForDuration(duration);

    // ── Check 1: Voiceover word count ────────────────────────────────────────
    totalChecks++;
    const voiceoverWords = countWords(scene.voiceover_text);
    if (voiceoverWords > rule.maxWords) {
      blockingIssues.push(
        `Scene "${scene.scene_id}" (${duration}s): voiceover has ${voiceoverWords} words ` +
          `(max ${rule.maxWords} for ${rule.label}).`
      );
      suggestedFixes.push(
        `Trim voiceover in scene "${scene.scene_id}" to ${rule.maxWords} words or fewer. ` +
          `Current: "${scene.voiceover_text.split(/\s+/).slice(0, 8).join(" ")}..."`
      );
    } else {
      checksPassed++;
    }

    // ── Check 2: Character count ─────────────────────────────────────────────
    totalChecks++;
    const charCount = scene.characters.length;
    if (charCount > rule.maxCharacters) {
      warnings.push(
        `Scene "${scene.scene_id}" (${duration}s): ${charCount} characters present ` +
          `(max recommended ${rule.maxCharacters} for ${rule.label}).`
      );
      suggestedFixes.push(
        `Reduce character count in scene "${scene.scene_id}" to ${rule.maxCharacters} or fewer for visual clarity.`
      );
    } else {
      checksPassed++;
    }

    // ── Check 3: Visual prompt complexity ─────────────────────────────────────
    totalChecks++;
    const visualIssues = detectOverlyComplexPrompt(scene.visual_prompt, duration);
    if (visualIssues.length > 0) {
      for (const issue of visualIssues) {
        warnings.push(`Scene "${scene.scene_id}" visual_prompt: ${issue}`);
      }
      suggestedFixes.push(
        `Simplify visual_prompt in scene "${scene.scene_id}" to a single clear visual moment.`
      );
    } else {
      checksPassed++;
    }

    // ── Check 4: Image prompt complexity ─────────────────────────────────────
    totalChecks++;
    const imageIssues = detectOverlyComplexPrompt(scene.image_prompt, duration);
    if (imageIssues.length > 0) {
      for (const issue of imageIssues) {
        warnings.push(`Scene "${scene.scene_id}" image_prompt: ${issue}`);
      }
      suggestedFixes.push(
        `Simplify image_prompt in scene "${scene.scene_id}". Focus on one key composition.`
      );
    } else {
      checksPassed++;
    }

    // ── Check 5: Complex action in 5s scenes ──────────────────────────────────
    if (duration <= 5) {
      totalChecks++;
      const hasComplexAction = detectComplexActionSequence(scene.visual_prompt + " " + scene.voiceover_text);
      if (hasComplexAction) {
        blockingIssues.push(
          `Scene "${scene.scene_id}" (5s): Contains complex multi-action sequence. ` +
            `5-second scenes must have a single visual beat.`
        );
        suggestedFixes.push(
          `Break scene "${scene.scene_id}" into 2+ shorter scenes, or reduce to one clear action.`
        );
      } else {
        checksPassed++;
      }
    }

    // ── Check 6: Empty critical fields ────────────────────────────────────────
    totalChecks++;
    const missingFields: string[] = [];
    if (!scene.visual_prompt) missingFields.push("visual_prompt");
    if (!scene.image_prompt) missingFields.push("image_prompt");
    if (!scene.voiceover_text) missingFields.push("voiceover_text");
    if (!scene.music_cue) missingFields.push("music_cue");

    if (missingFields.length > 0) {
      warnings.push(
        `Scene "${scene.scene_id}" is missing critical fields: ${missingFields.join(", ")}.`
      );
      suggestedFixes.push(
        `Fill in missing fields for scene "${scene.scene_id}": ${missingFields.join(", ")}.`
      );
    } else {
      checksPassed++;
    }

    // ── Check 7: Subtitle text vs voiceover consistency ───────────────────────
    totalChecks++;
    const subtitleWords = countWords(scene.subtitle_text);
    if (subtitleWords > 0 && voiceoverWords > 0) {
      const ratio = subtitleWords / voiceoverWords;
      if (ratio > 1.5 || ratio < 0.3) {
        warnings.push(
          `Scene "${scene.scene_id}": subtitle_text (${subtitleWords}w) significantly diverges from ` +
            `voiceover_text (${voiceoverWords}w). Check alignment.`
        );
      } else {
        checksPassed++;
      }
    } else {
      checksPassed++;
    }
  }

  const rawScore = totalChecks > 0 ? Math.round((checksPassed / totalChecks) * 100) : 100;
  const penaltyPerBlock = 10;
  const score = Math.max(0, rawScore - blockingIssues.length * penaltyPerBlock);
  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    metadata: {
      totalScenes: scenes.length,
      totalChecks,
      checksPassed,
      sceneDurationSeconds: contract.sceneDurationSeconds,
    },
  };
}
