// Story Screening — pure client-side pre-validation, no AI calls

import type { SupervisorResult, StoryContract, StoryType } from "./types";

// Words per minute for voiceover/reading
const VOICEOVER_WPM = 130;

const ADULT_WORDS = [
  "kill", "murder", "blood", "gore", "sex", "naked", "nude", "rape",
  "violent", "brutally", "massacre", "execution", "torture", "explicit",
  "pornographic", "terror", "bomb", "stab", "shoot", "gunshot", "decapitat",
];

const STRUCTURE_INTRO_KEYWORDS = [
  "once upon", "one day", "there was", "there lived", "it was", "in a",
  "long ago", "in the", "meet", "our story", "begin", "start",
];

const STRUCTURE_CONFLICT_KEYWORDS = [
  "but", "however", "problem", "challenge", "danger", "suddenly", "crisis",
  "trouble", "struggle", "obstacle", "fear", "worried", "threatened",
  "conflict", "argument", "disaster", "emergency", "shock", "alarm",
  "unfortunately", "tragedy", "difficult", "enemy", "villain",
];

const STRUCTURE_RESOLUTION_KEYWORDS = [
  "finally", "at last", "resolved", "saved", "learned", "realized",
  "happy", "peace", "success", "overcome", "victory", "end", "lesson",
  "moral", "conclusion", "forgave", "healed", "together", "better",
  "improved", "decision", "changed", "grew", "understood",
];

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function countOccurrences(text: string, word: string): number {
  const regex = new RegExp(`\\b${word}\\b`, "gi");
  return (text.match(regex) ?? []).length;
}

function hasKeywordFromList(text: string, list: string[]): boolean {
  const lower = text.toLowerCase();
  return list.some((kw) => lower.includes(kw));
}

function detectAdultContent(text: string): string[] {
  const lower = text.toLowerCase();
  return ADULT_WORDS.filter((w) => lower.includes(w));
}

function detectMultiActionSequences(text: string): number {
  // "then ... then ... then" pattern counts as multi-action
  const matches = text.match(/\bthen\b/gi) ?? [];
  return Math.max(0, matches.length - 1);
}

function getWordLimits(storyType: StoryType): { min: number; max: number } {
  switch (storyType) {
    case "short_story":
    case "skit":
    case "ad_commercial":
      return { min: 20, max: 300 };
    case "children_story":
      return { min: 20, max: 400 };
    case "long_story":
    case "movie":
    case "documentary":
    case "folklore":
    case "faith_story":
    case "educational":
    case "moral_lesson":
      return { min: 200, max: 2000 };
    default:
      return { min: 20, max: 2000 };
  }
}

export function runStoryScreening(
  storyText: string,
  contract: StoryContract
): SupervisorResult<{ issues: string[]; score: number }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];
  const issues: string[] = [];

  let checksTotal = 0;
  let checksPassed = 0;

  const wordCount = countWords(storyText);
  const limits = getWordLimits(contract.storyType);

  // ── Check 1: Minimum length ──────────────────────────────────────────────
  checksTotal++;
  if (wordCount < 20) {
    blockingIssues.push(`Story too short (${wordCount} words). Minimum is 20 words.`);
    issues.push("Story too short");
    suggestedFixes.push("Expand the story with more detail and character actions.");
  } else {
    checksPassed++;
  }

  // ── Check 2: Maximum length for story type ────────────────────────────────
  checksTotal++;
  if (wordCount > limits.max) {
    blockingIssues.push(
      `Story too long for ${contract.storyType} (${wordCount} words, max ${limits.max}).`
    );
    issues.push(`Story exceeds word limit for ${contract.storyType}`);
    suggestedFixes.push(`Trim story to under ${limits.max} words for ${contract.storyType}.`);
  } else {
    checksPassed++;
  }

  // ── Check 3: Minimum length for long-form types ───────────────────────────
  if (limits.min > 50) {
    checksTotal++;
    if (wordCount < limits.min) {
      blockingIssues.push(
        `${contract.storyType} requires at least ${limits.min} words (got ${wordCount}).`
      );
      issues.push(`Insufficient length for ${contract.storyType}`);
      suggestedFixes.push(
        `Expand the story to at least ${limits.min} words. Add scenes, dialogue, or backstory.`
      );
    } else {
      checksPassed++;
    }
  }

  // ── Check 4: Story structure — intro ─────────────────────────────────────
  checksTotal++;
  const hasIntro = hasKeywordFromList(storyText, STRUCTURE_INTRO_KEYWORDS);
  if (!hasIntro) {
    warnings.push("Story may lack a clear introduction. No opening cues detected.");
    issues.push("Missing clear introduction");
    suggestedFixes.push('Start with a clear scene-setter: "One day...", "There lived...", etc.');
  } else {
    checksPassed++;
  }

  // ── Check 5: Story structure — conflict ───────────────────────────────────
  checksTotal++;
  const hasConflict = hasKeywordFromList(storyText, STRUCTURE_CONFLICT_KEYWORDS);
  if (!hasConflict) {
    warnings.push("No conflict or tension keywords detected. Story may lack dramatic structure.");
    issues.push("Missing conflict/tension");
    suggestedFixes.push("Add a problem, challenge, or turning point for the character.");
  } else {
    checksPassed++;
  }

  // ── Check 6: Story structure — resolution ────────────────────────────────
  checksTotal++;
  const hasResolution = hasKeywordFromList(storyText, STRUCTURE_RESOLUTION_KEYWORDS);
  if (!hasResolution) {
    warnings.push("No resolution keywords detected. Story may end abruptly.");
    issues.push("Missing resolution");
    suggestedFixes.push(
      'End the story with a clear conclusion, lesson, or emotional beat ("finally", "at last", etc.).'
    );
  } else {
    checksPassed++;
  }

  // ── Check 7: Repeated "said" ──────────────────────────────────────────────
  checksTotal++;
  const saidCount = countOccurrences(storyText, "said");
  if (saidCount > 15) {
    warnings.push(
      `"said" used ${saidCount} times. Repetitive dialogue tags hurt voiceover quality.`
    );
    issues.push(`Overuse of "said" (${saidCount} times)`);
    suggestedFixes.push(
      'Replace some instances of "said" with: replied, whispered, shouted, explained, asked, answered.'
    );
    checksPassed++; // Warning only, not blocking
  } else {
    checksPassed++;
  }

  // ── Check 8: Children story — adult content guard ────────────────────────
  if (contract.storyType === "children_story") {
    checksTotal++;
    const foundAdult = detectAdultContent(storyText);
    if (foundAdult.length > 0) {
      blockingIssues.push(
        `Children's story contains inappropriate words: ${foundAdult.slice(0, 5).join(", ")}.`
      );
      issues.push("Adult content in children story");
      suggestedFixes.push("Remove violent or adult-themed language. Keep tone gentle and safe.");
    } else {
      checksPassed++;
    }
  }

  // ── Check 9: Duration feasibility ────────────────────────────────────────
  checksTotal++;
  const estimatedReadingSeconds = (wordCount / VOICEOVER_WPM) * 60;
  const durationRatio = estimatedReadingSeconds / contract.totalDurationSeconds;

  if (durationRatio > 2.5) {
    warnings.push(
      `Story text (${wordCount} words ≈ ${Math.round(estimatedReadingSeconds)}s reading) ` +
        `greatly exceeds target duration (${contract.totalDurationSeconds}s). ` +
        `Narration will be heavily compressed.`
    );
    issues.push("Story too dense for target duration");
    suggestedFixes.push("Shorten the story or increase the target duration.");
  } else if (durationRatio < 0.2) {
    warnings.push(
      `Story text may be too sparse for a ${contract.totalDurationSeconds}s video. ` +
        `Consider adding more narrative detail.`
    );
  }
  checksPassed++;

  // ── Check 10: Multi-action sequence density ───────────────────────────────
  checksTotal++;
  const multiActionCount = detectMultiActionSequences(storyText);
  if (multiActionCount > 8) {
    warnings.push(
      `${multiActionCount} "then...then" multi-action sequences detected. ` +
        `May cause awkward scene demarcation.`
    );
    issues.push("Too many chained action sequences");
    suggestedFixes.push(
      "Break long action chains into separate paragraphs for cleaner scene splitting."
    );
  }
  checksPassed++;

  const rawScore = checksTotal > 0 ? Math.round((checksPassed / checksTotal) * 100) : 0;
  // Penalize heavily for each blocking issue
  const penaltyPerBlock = 20;
  const score = Math.max(0, rawScore - blockingIssues.length * penaltyPerBlock);

  const passed = blockingIssues.length === 0 && score >= 40;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { issues, score },
    metadata: {
      wordCount,
      estimatedReadingSeconds: Math.round(estimatedReadingSeconds),
      targetDurationSeconds: contract.totalDurationSeconds,
      checksTotal,
      checksPassed,
    },
  };
}
