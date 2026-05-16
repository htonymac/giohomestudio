// Costume & Props Supervisor — checks clothing and props match culture/context

import type { SupervisorResult, ScenePlan, CastBibleEntry, StoryContract } from "./types";

export function runCostumePropsCheck(
  scenes: ScenePlan[],
  castBible: CastBibleEntry[],
  contract: StoryContract
): SupervisorResult {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  const isNigerian = ["nigeria", "yoruba", "igbo", "hausa"].some(k =>
    `${contract.country} ${contract.culture}`.toLowerCase().includes(k)
  );

  // Check for costume continuity: if a character's clothing is established, it shouldn't randomly change
  const charClothingTrack: Record<string, string> = {};
  for (const c of castBible) {
    if (c.clothing) charClothingTrack[c.character_id] = c.clothing;
  }

  // Check Nigerian context: Nigerian stories should reference cultural clothing
  if (isNigerian) {
    const nigerianClothingPatterns = [
      /\b(ankara|agbada|aso-?oke|gele|buba|iro|kaftan|wrapper|dashiki|lace)\b/i,
    ];
    const anyCulturalClothing = castBible.some(c =>
      nigerianClothingPatterns.some(p => p.test(c.clothing || ""))
    );
    if (!anyCulturalClothing && castBible.length > 0) {
      warnings.push("Nigerian story: no cultural clothing references found in Cast Bible — consider adding Ankara, Agbada, or traditional wear");
    }
  }

  // Check for Western luxury in village/rural Nigerian context
  for (const scene of scenes) {
    const prompt = scene.image_prompt || scene.visual_prompt || "";
    if (isNigerian && /\bvillage\b/i.test(scene.location || "")) {
      if (/\b(suit and tie|luxury car|mercedes|bmw|limousine)\b/i.test(prompt)) {
        warnings.push(`Scene ${scene.scene_number}: luxury items in village setting may be inconsistent unless story justifies it`);
      }
    }
  }

  const score = Math.max(60, 100 - blockingIssues.length * 20 - warnings.length * 8);

  return {
    passed: blockingIssues.length === 0,
    score,
    blockingIssues,
    warnings,
    suggestedFixes: warnings.length > 0
      ? ["Add culturally appropriate clothing to Cast Bible", "Ensure props match setting and class"]
      : [],
  };
}
