// Location & Environment Supervisor — checks country/culture realism in locations

import type { SupervisorResult, ScenePlan, StoryContract } from "./types";

const NIGERIA_WRONG_LOCATIONS = [
  /\bsnow\b/i, /\bblizzard\b/i, /\bski\b/i, /\beurope[an]?\b/i,
  /\bsubway\b/i, /\btimes square\b/i, /\bniagara\b/i, /\balpine\b/i,
];
const NIGERIA_GOOD_CUES = [
  /\blagos\b/i, /\babuja\b/i, /\bcompound\b/i, /\bdanfo\b/i,
  /\bokada\b/i, /\bmarket\b/i, /\bmotorcycle taxi\b/i, /\bharmonattan\b/i,
];

function isAfricanContext(contract: StoryContract): boolean {
  const combined = `${contract.country} ${contract.culture}`.toLowerCase();
  return ["nigeria", "nigerian", "ghana", "kenya", "african", "yoruba", "igbo", "hausa"].some(k => combined.includes(k));
}

export function runLocationEnvironmentCheck(
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!isAfricanContext(contract)) {
    return { passed: true, score: 90, blockingIssues: [], warnings: [], suggestedFixes: [] };
  }

  for (const scene of scenes) {
    const prompt = `${scene.visual_prompt || ""} ${scene.image_prompt || ""} ${scene.location || ""}`;

    for (const pattern of NIGERIA_WRONG_LOCATIONS) {
      if (pattern.test(prompt)) {
        blockingIssues.push(`Scene ${scene.scene_number}: location appears culturally mismatched (${pattern.source}) for ${contract.country} story`);
      }
    }
  }

  // Check if any scenes have good cultural location cues
  const anyGoodCues = scenes.some(s => {
    const prompt = `${s.visual_prompt || ""} ${s.location || ""}`;
    return NIGERIA_GOOD_CUES.some(p => p.test(prompt));
  });

  if (!anyGoodCues && scenes.length > 0) {
    warnings.push(`No culturally specific location cues found for ${contract.country} — consider adding local landmarks or environments`);
  }

  const score = Math.max(0, 100 - blockingIssues.length * 20 - warnings.length * 5);

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes: blockingIssues.length > 0
      ? [`Replace wrong location cues with ${contract.country}-appropriate settings`]
      : [],
  };
}
