// Prompt vs Cast Validator — checks every visual prompt against Cast Bible identity
// Distinct from cast-checking.ts: this validates GENERATED PROMPTS, not story text

import type { SupervisorResult, ScenePlan, CastBibleEntry } from "./types";

const RACE_CHANGE_PATTERNS = [
  /\b(white|caucasian|blonde|fair-?skinned|pale|blue-eyed|green-eyed)\b/i,
];

const AGE_ESCALATION_PATTERNS = [
  /\b(adult|grown|mature|elderly|old man|old woman|teenager|young adult)\b/i,
];

const EUROPEAN_PATTERNS = [
  /\b(european|american suburb|western|christmas town|snowy street|new york|london suburb|white picket fence)\b/i,
];

function promptChangesRace(prompt: string, entry: CastBibleEntry): boolean {
  const isAfrican =
    entry.ethnicity.toLowerCase().includes("black") ||
    entry.ethnicity.toLowerCase().includes("african") ||
    entry.ethnicity.toLowerCase().includes("nigerian");

  if (!isAfrican) return false;

  return RACE_CHANGE_PATTERNS.some(p => p.test(prompt));
}

function promptChangesAge(prompt: string, entry: CastBibleEntry): boolean {
  const charIsChild = /\b(child|boy|girl|kid|toddler|infant|teen|young|juvenile)\b/i.test(entry.age);
  if (!charIsChild) return false;

  // If character is defined as a child but prompt describes adult
  return /\b(adult man|grown man|middle-aged|elderly|old man|businessman|corporate)\b/i.test(prompt);
}

function promptChangesGender(prompt: string, entry: CastBibleEntry): boolean {
  const isFemale = entry.gender.toLowerCase().includes("female") || entry.gender.toLowerCase().includes("woman") || entry.gender.toLowerCase().includes("girl");
  const isMale = entry.gender.toLowerCase().includes("male") || entry.gender.toLowerCase().includes("man") || entry.gender.toLowerCase().includes("boy");

  if (isFemale && /\b(man|boy|gentleman|male|he is)\b/i.test(prompt)) return true;
  if (isMale && /\b(woman|girl|lady|female|she is)\b/i.test(prompt)) return true;
  return false;
}

function promptChangesClothing(prompt: string, entry: CastBibleEntry): boolean {
  // Only flag if costume changes dramatically without scene note
  const hasWesternSuit = /\b(suit and tie|tuxedo|business suit)\b/i.test(prompt);
  const wearsCultural = /\b(ankara|agbada|wrapper|kaftan|gele|iro|buba|lace|aso-?oke|dashiki)\b/i.test(entry.clothing);
  return hasWesternSuit && wearsCultural;
}

interface ValidationIssue {
  scene_number: number;
  character_id: string;
  character_name: string;
  issue: string;
  field: string;
  original_prompt: string;
  suggested_fix: string;
}

export function runPromptCastValidator(
  scenes: ScenePlan[],
  castBible: CastBibleEntry[]
): SupervisorResult<{ issues: ValidationIssue[] }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const issues: ValidationIssue[] = [];

  for (const scene of scenes) {
    const prompt = `${scene.image_prompt || ""} ${scene.visual_prompt || ""} ${scene.video_prompt || ""}`;
    if (!prompt.trim()) continue;

    for (const charId of (scene.characters || [])) {
      const entry = castBible.find(c => c.character_id === charId);
      if (!entry) continue;

      if (promptChangesRace(prompt, entry)) {
        const issue: ValidationIssue = {
          scene_number: scene.scene_number,
          character_id: charId,
          character_name: entry.name,
          issue: `Prompt changes ${entry.name} (${charId}) race/ethnicity from "${entry.ethnicity}"`,
          field: "ethnicity",
          original_prompt: prompt.trim().slice(0, 100),
          suggested_fix: `Replace with: ${entry.age} ${entry.ethnicity} ${entry.gender}, ${entry.skin_tone} skin, ${entry.hair}`,
        };
        issues.push(issue);
        blockingIssues.push(`Scene ${scene.scene_number}: prompt changes ${entry.name} ethnicity — must match Cast Bible (${entry.ethnicity})`);
      }

      if (promptChangesAge(prompt, entry)) {
        const issue: ValidationIssue = {
          scene_number: scene.scene_number,
          character_id: charId,
          character_name: entry.name,
          issue: `Prompt describes ${entry.name} as adult but Cast Bible says "${entry.age}"`,
          field: "age",
          original_prompt: prompt.trim().slice(0, 100),
          suggested_fix: `Rewrite prompt to describe ${entry.name} as ${entry.age} — do not age up the character`,
        };
        issues.push(issue);
        blockingIssues.push(`Scene ${scene.scene_number}: ${entry.name} age mismatch — Cast Bible says "${entry.age}"`);
      }

      if (promptChangesGender(prompt, entry)) {
        const issue: ValidationIssue = {
          scene_number: scene.scene_number,
          character_id: charId,
          character_name: entry.name,
          issue: `Prompt changes ${entry.name} gender from "${entry.gender}"`,
          field: "gender",
          original_prompt: prompt.trim().slice(0, 100),
          suggested_fix: `Rewrite prompt to correctly describe ${entry.name} as ${entry.gender}`,
        };
        issues.push(issue);
        blockingIssues.push(`Scene ${scene.scene_number}: ${entry.name} gender mismatch`);
      }

      if (promptChangesClothing(prompt, entry)) {
        const issue: ValidationIssue = {
          scene_number: scene.scene_number,
          character_id: charId,
          character_name: entry.name,
          issue: `Prompt puts ${entry.name} in formal Western suit but Cast Bible has "${entry.clothing}" — no costume change noted`,
          field: "clothing",
          original_prompt: prompt.trim().slice(0, 100),
          suggested_fix: `Use Cast Bible clothing: "${entry.clothing}" unless scene notes include a costume change`,
        };
        issues.push(issue);
        warnings.push(`Scene ${scene.scene_number}: ${entry.name} clothing may not match Cast Bible`);
      }
    }

    // Check for European/American setting in Nigerian stories
    if (EUROPEAN_PATTERNS.some(p => p.test(prompt))) {
      warnings.push(`Scene ${scene.scene_number}: prompt may contain non-cultural setting — verify it matches story contract`);
    }
  }

  const score = Math.max(0, 100 - blockingIssues.length * 20 - warnings.length * 5);

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes: blockingIssues.length > 0
      ? ["Update scene prompts to match Cast Bible — do not change character race, age, or gender in prompts"]
      : [],
    revisedData: { issues },
  };
}
