// Scene Prompt Builder — finalizes each scene's complete prompt package

import type { SupervisorResult, ScenePlan, CastBibleEntry, StoryContract } from "./types";

function buildNegativePrompt(contract: StoryContract, scene: ScenePlan): string {
  const base = "blurry, low quality, distorted, watermark, text overlay, signature";
  const culturalExclusions: string[] = [];

  const isAfrican = ["nigeria", "yoruba", "igbo", "hausa", "african", "ghana", "kenya"].some(k =>
    `${contract.country} ${contract.culture}`.toLowerCase().includes(k)
  );

  if (isAfrican && !scene.characters?.some(() => true)) {
    culturalExclusions.push("white cast, blonde hair, European setting, snow, American suburb");
  }

  return [base, ...culturalExclusions].join(", ");
}

function injectCastBibleIntoCaptions(prompt: string, characters: string[], castBible: CastBibleEntry[]): string {
  if (!characters || characters.length === 0) return prompt;

  const identities = characters
    .map(id => castBible.find(c => c.character_id === id))
    .filter(Boolean) as CastBibleEntry[];

  if (identities.length === 0) return prompt;

  const castDescription = identities
    .map(c => `${c.name}: ${c.age} ${c.gender}, ${c.ethnicity}, ${c.skin_tone} skin, ${c.hair}, wearing ${c.clothing}`)
    .join("; ");

  if (prompt.includes(castDescription)) return prompt;
  return `${prompt} — Characters: ${castDescription}`;
}

export function runScenePromptBuilder(
  scenes: ScenePlan[],
  castBible: CastBibleEntry[],
  contract: StoryContract
): SupervisorResult<{ builtScenes: ScenePlan[] }> {
  const builtScenes: ScenePlan[] = [];
  const warnings: string[] = [];

  for (const scene of scenes) {
    const negativePrompt = scene.negative_prompt || buildNegativePrompt(contract, scene);

    // Inject cast bible into image/video prompts for identity consistency
    const imagePrompt = injectCastBibleIntoCaptions(
      scene.image_prompt || scene.visual_prompt || "",
      scene.characters || [],
      castBible
    );

    const videoPrompt = injectCastBibleIntoCaptions(
      scene.video_prompt || scene.visual_prompt || "",
      scene.characters || [],
      castBible
    );

    // Ensure subtitle_text falls back to voiceover_text if missing
    const subtitleText = scene.subtitle_text || scene.voiceover_text || "";

    if (!scene.image_prompt && !scene.visual_prompt) {
      warnings.push(`Scene ${scene.scene_number}: no visual prompt — add a description for image generation`);
    }

    builtScenes.push({
      ...scene,
      image_prompt: imagePrompt,
      video_prompt: videoPrompt,
      negative_prompt: negativePrompt,
      subtitle_text: subtitleText,
      subtitle_style: scene.subtitle_style || contract.subtitleStyle,
    });
  }

  return {
    passed: warnings.length === 0,
    score: Math.max(70, 100 - warnings.length * 10),
    blockingIssues: [],
    warnings,
    suggestedFixes: warnings.length > 0 ? ["Add visual prompts to scenes missing them"] : [],
    revisedData: { builtScenes },
  };
}
