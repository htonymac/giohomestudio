// Cast Checking — validates scene prompts against the Cast Bible

import type { SupervisorResult, ScenePlan, CastBibleEntry } from "./types";

interface SceneIssueRecord {
  sceneId: string;
  issues: string[];
}

// Ethnicity keywords to check for consistency
const WHITE_INDICATORS = ["white", "pale", "caucasian", "blonde", "european-looking", "light-skinned european"];
const ASIAN_INDICATORS = ["east asian", "japanese", "chinese", "korean", "light asian"];

// Words in prompts that may indicate wrong ethnicity
function detectEthnicityConflict(
  promptText: string,
  expectedEthnicity: string
): string | null {
  const promptLower = promptText.toLowerCase();
  const expectedLower = expectedEthnicity.toLowerCase();
  const isExpectedBlack =
    expectedLower.includes("black") ||
    expectedLower.includes("african") ||
    expectedLower.includes("nigerian");

  if (isExpectedBlack) {
    const hasWhiteIndicator = WHITE_INDICATORS.some((kw) => promptLower.includes(kw));
    if (hasWhiteIndicator) {
      return `Prompt implies non-African/non-Black ethnicity but character is "${expectedEthnicity}"`;
    }
  }

  return null;
}

function detectAgeConflict(promptText: string, expectedAge: string): string | null {
  const promptLower = promptText.toLowerCase();
  const ageLower = expectedAge.toLowerCase();

  const isExpectedChild =
    ageLower.includes("child") ||
    ageLower.includes("teen") ||
    ageLower.includes("young") ||
    parseInt(expectedAge) < 18;

  const isExpectedElderly =
    ageLower.includes("elder") ||
    ageLower.includes("old") ||
    ageLower.includes("aged") ||
    parseInt(expectedAge) > 65;

  const promptImpliesOld = /\b(elderly|old man|old woman|senior|aged)\b/i.test(promptText);
  const promptImpliesYoung = /\b(child|kid|toddler|baby|infant|teenage|teen)\b/i.test(promptText);

  if (isExpectedChild && promptImpliesOld) {
    return `Prompt implies elderly person but character "${expectedAge}" is young`;
  }

  if (isExpectedElderly && promptImpliesYoung) {
    return `Prompt implies young/child but character "${expectedAge}" is elderly`;
  }

  const ageNum = parseInt(expectedAge);
  if (!isNaN(ageNum)) {
    if (ageNum < 18 && promptImpliesOld) {
      return `Prompt implies old person but character age is ${ageNum}`;
    }
    if (ageNum > 60 && promptImpliesYoung) {
      return `Prompt implies child/young person but character age is ${ageNum}`;
    }
  }

  return null;
}

function detectGenderConflict(promptText: string, expectedGender: string): string | null {
  const promptLower = promptText.toLowerCase();
  const genderLower = expectedGender.toLowerCase();

  const isMale =
    genderLower === "male" || genderLower === "man" || genderLower === "boy";
  const isFemale =
    genderLower === "female" || genderLower === "woman" || genderLower === "girl";

  const promptHasFemale = /\b(woman|female|girl|she|her)\b/i.test(promptText);
  const promptHasMale = /\b(man|male|boy|he|him)\b/i.test(promptText);

  if (isMale && promptHasFemale && !promptHasMale) {
    return `Prompt uses female pronouns/terms but character is ${expectedGender}`;
  }

  if (isFemale && promptHasMale && !promptHasFemale) {
    return `Prompt uses male pronouns/terms but character is ${expectedGender}`;
  }

  return null;
}

function buildCharacterLookup(castBible: CastBibleEntry[]): Map<string, CastBibleEntry> {
  const lookup = new Map<string, CastBibleEntry>();
  for (const c of castBible) {
    lookup.set(c.character_id.toLowerCase(), c);
    lookup.set(c.name.toLowerCase(), c);
  }
  return lookup;
}

export function runCastCheck(
  scenes: ScenePlan[],
  castBible: CastBibleEntry[]
): SupervisorResult<{ sceneIssues: SceneIssueRecord[] }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];
  const sceneIssues: SceneIssueRecord[] = [];

  const lookup = buildCharacterLookup(castBible);

  let totalChecks = 0;
  let checksPassed = 0;

  for (const scene of scenes) {
    const sceneIssueList: string[] = [];

    // Check each character_id listed in the scene
    for (const charId of scene.characters) {
      const character =
        lookup.get(charId.toLowerCase()) ??
        lookup.get(charId.replace(/_/g, " ").toLowerCase());

      if (!character) {
        totalChecks++;
        sceneIssueList.push(
          `Character "${charId}" in scene ${scene.scene_id} is not found in Cast Bible.`
        );
        warnings.push(
          `Scene "${scene.scene_id}" references unknown character "${charId}".`
        );
        suggestedFixes.push(
          `Add "${charId}" to the Cast Bible or fix the character ID in scene "${scene.scene_id}".`
        );
        continue;
      }

      // Check visual_prompt for consistency
      const promptsToCheck = [
        { label: "visual_prompt", text: scene.visual_prompt },
        { label: "image_prompt", text: scene.image_prompt },
      ];

      for (const { label, text } of promptsToCheck) {
        if (!text) continue;

        // Ethnicity check — only run if prompt explicitly names the character
        const nameInPrompt = text.toLowerCase().includes(character.name.toLowerCase());
        if (nameInPrompt) {
          totalChecks++;
          const ethConflict = detectEthnicityConflict(text, character.ethnicity);
          if (ethConflict) {
            sceneIssueList.push(`[${label}] ${ethConflict} for "${character.name}"`);
            blockingIssues.push(
              `Scene "${scene.scene_id}" ${label}: ${ethConflict}`
            );
            suggestedFixes.push(
              `Update ${label} in scene "${scene.scene_id}" to reflect ` +
                `${character.name}'s ethnicity: "${character.ethnicity}", skin tone: "${character.skin_tone}".`
            );
          } else {
            checksPassed++;
          }

          totalChecks++;
          const ageConflict = detectAgeConflict(text, character.age);
          if (ageConflict) {
            sceneIssueList.push(`[${label}] ${ageConflict} for "${character.name}"`);
            warnings.push(`Scene "${scene.scene_id}" ${label}: ${ageConflict}`);
            suggestedFixes.push(
              `Adjust ${label} in scene "${scene.scene_id}" to match ${character.name}'s age: "${character.age}".`
            );
          } else {
            checksPassed++;
          }

          totalChecks++;
          const genderConflict = detectGenderConflict(text, character.gender);
          if (genderConflict) {
            sceneIssueList.push(`[${label}] ${genderConflict} for "${character.name}"`);
            warnings.push(`Scene "${scene.scene_id}" ${label}: ${genderConflict}`);
            suggestedFixes.push(
              `Fix gender references for ${character.name} (${character.gender}) in ${label} of scene "${scene.scene_id}".`
            );
          } else {
            checksPassed++;
          }
        } else {
          // Character not mentioned by name in prompt — just count as passed
          totalChecks++;
          checksPassed++;
        }
      }
    }

    // Check negative_prompt: should exclude wrong ethnicities for African stories
    totalChecks++;
    if (castBible.length > 0) {
      const anyBlackChar = castBible.some(
        (c) =>
          c.ethnicity.toLowerCase().includes("black") ||
          c.ethnicity.toLowerCase().includes("african")
      );

      if (anyBlackChar && scene.negative_prompt) {
        const negLower = scene.negative_prompt.toLowerCase();
        const lacksEthnicityNegation =
          !negLower.includes("white") &&
          !negLower.includes("caucasian") &&
          !negLower.includes("european") &&
          !negLower.includes("asian");

        if (lacksEthnicityNegation) {
          warnings.push(
            `Scene "${scene.scene_id}" negative_prompt does not exclude white/caucasian/Asian faces ` +
              `despite African cast. Add "white skin, caucasian, european features, asian features" to negative_prompt.`
          );
          sceneIssueList.push(
            "negative_prompt missing ethnicity exclusions for African cast"
          );
        } else {
          checksPassed++;
        }
      } else {
        checksPassed++;
      }
    } else {
      checksPassed++;
    }

    if (sceneIssueList.length > 0) {
      sceneIssues.push({ sceneId: scene.scene_id, issues: sceneIssueList });
    }
  }

  const rawScore = totalChecks > 0 ? Math.round((checksPassed / totalChecks) * 100) : 100;
  const penaltyPerBlock = 15;
  const score = Math.max(0, rawScore - blockingIssues.length * penaltyPerBlock);
  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { sceneIssues },
    metadata: {
      totalScenes: scenes.length,
      scenesWithIssues: sceneIssues.length,
      totalChecks,
      checksPassed,
      castBibleSize: castBible.length,
    },
  };
}
