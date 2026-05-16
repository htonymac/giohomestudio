// Prompt Simplifier Supervisor — rewrites AI story into clear, visual language

import type { SupervisorResult, StoryContract, LanguageLevel } from "./types";

const COMPLEX_PATTERNS = [
  /\b(amidst|existential|socioeconomic|paradigm|transcend|contemplat|juxtapos|perpetuat|omnipresent|ethereal|ephemeral|quintessential|manifestation|dichotomy|catalyze)\b/gi,
  /\b(despite the inherent|by virtue of|in the context of|with regards to|notwithstanding)\b/gi,
  /\b(battled the invisible|storm of destiny|invisible forces|cosmic significance|philosophical undertones)\b/gi,
];

const VOICEOVER_TOO_LONG_THRESHOLD: Record<number, number> = {
  5: 14,
  8: 22,
  10: 28,
  15: 42,
  20: 56,
  30: 84,
};

function getMaxWords(durationSec: number): number {
  const keys = Object.keys(VOICEOVER_TOO_LONG_THRESHOLD).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    if (durationSec <= k) return VOICEOVER_TOO_LONG_THRESHOLD[k];
  }
  return Math.floor(durationSec * 2.4);
}

function detectComplexity(text: string): string[] {
  const found: string[] = [];
  for (const pattern of COMPLEX_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) found.push(...matches.map(m => m.trim()));
  }
  return [...new Set(found)];
}

function assessReadability(text: string, level: LanguageLevel): { score: number; issues: string[] } {
  const issues: string[] = [];
  const words = text.trim().split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgWordsPerSentence = words.length / Math.max(1, sentences.length);

  if (level === "simple_english" || level === "childrens_english") {
    if (avgWordsPerSentence > 15) {
      issues.push(`Average sentence length ${Math.round(avgWordsPerSentence)} words — simplify to under 12 words per sentence`);
    }
  }

  if (level === "voiceover_friendly" || level === "subtitle_friendly") {
    if (avgWordsPerSentence > 18) {
      issues.push(`Sentences too long for voiceover pacing — aim for 10–15 words per sentence`);
    }
  }

  if (level === "nigerian_english") {
    const hasLocalFlavour = /\b(na|abi|dey|wahala|pikin|oga|mama|baba|sha|o$)\b/i.test(text);
    if (!hasLocalFlavour && text.length > 100) {
      issues.push("Nigerian English level selected but no Nigerian speech patterns detected — consider adding local flavour");
    }
  }

  const complexWords = detectComplexity(text);
  if (complexWords.length > 0) {
    issues.push(`Complex or abstract words detected: ${complexWords.slice(0, 5).join(", ")}`);
  }

  const score = Math.max(40, 100 - issues.length * 15 - complexWords.length * 5);
  return { score, issues };
}

function checkSceneVoiceovers(
  storyText: string,
  sceneDurationSec: number
): string[] {
  const warnings: string[] = [];
  const maxWords = getMaxWords(sceneDurationSec);

  // Check paragraph-level word counts as proxy for scene voiceovers
  const paragraphs = storyText.split(/\n+/).filter(p => p.trim().length > 20);
  for (let i = 0; i < paragraphs.length; i++) {
    const words = paragraphs[i].trim().split(/\s+/).length;
    if (words > maxWords * 1.5) {
      warnings.push(
        `Paragraph ${i + 1} has ${words} words — for ${sceneDurationSec}s scenes, max voiceover is ~${maxWords} words`
      );
    }
  }

  return warnings;
}

export function runPromptSimplifier(
  storyText: string,
  contract: StoryContract
): SupervisorResult<{ assessedText: string }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const { score, issues } = assessReadability(storyText, contract.languageLevel);

  for (const issue of issues) {
    if (issue.includes("Complex or abstract")) {
      warnings.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  const voiceoverWarnings = checkSceneVoiceovers(storyText, contract.sceneDurationSeconds);
  warnings.push(...voiceoverWarnings);

  // Hard block: children story with adult/violent language
  if (contract.storyType === "children_story") {
    const adultPatterns = /\b(kill|murder|blood|violence|sex|death|die|corpse|brutal)\b/gi;
    const adultMatches = storyText.match(adultPatterns);
    if (adultMatches && adultMatches.length > 2) {
      blockingIssues.push(
        `Children story contains adult/violent language: ${[...new Set(adultMatches)].join(", ")} — rewrite for child audience`
      );
    }
  }

  // Warn if story has no visual action (hard to generate images/video from)
  const hasVisualAction = /\b(walk|run|stand|sit|look|see|open|close|enter|leave|hold|pick|put|give|take|cry|laugh|smile|wave|fall|rise|move|jump|dance|fight|hug|point|show)\b/gi.test(storyText);
  if (!hasVisualAction) {
    warnings.push("Story has no clear visual actions — may be difficult to generate scene images/video from");
  }

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes: [
      ...(issues.length > 0 ? [`Rewrite to ${contract.languageLevel} — clear, short sentences, no abstract language`] : []),
      ...(voiceoverWarnings.length > 0 ? [`Keep each scene's spoken content under ${getMaxWords(contract.sceneDurationSeconds)} words for ${contract.sceneDurationSeconds}s scenes`] : []),
    ],
    revisedData: { assessedText: storyText },
  };
}
