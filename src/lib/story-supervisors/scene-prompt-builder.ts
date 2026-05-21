// Scene Prompt Builder — finalizes each scene's complete prompt package

import type { SupervisorResult, ScenePlan, SceneTag, CastBibleEntry, StoryContract } from "./types";

// Tag-specific cinematic modifiers injected into image prompts
// when scene_tag is set by the structure-story step
const TAG_MODIFIERS: Record<SceneTag, string> = {
  VISUAL:     "dramatic focal point, cinematic composition, emotional weight, story-telling image",
  ACTION:     "dynamic camera angle, sense of motion, physical energy, tension, action shot",
  BEAT:       "close-up, stillness, emotional expression, soft focus background, intimate moment",
  DIALOGUE:   "character facing camera, clear facial expression, natural lighting, conversational framing",
  NARRATION:  "establishing context, wide environment visible, atmospheric, cinematic background",
  TRANSITION: "in-between moment, time-lapse feeling, movement across space, bridge shot",
  ESTABLISH:  "wide establishing shot, full environment visible, depth of field, scene-setting",
};

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

  // Match by character_id OR name (case-insensitive). Scene-plan AI returns short
  // CH01-style placeholders OR display names; cast bible may be keyed either way.
  const identities = characters
    .map(id => {
      if (!id) return null;
      const idLower = id.toLowerCase();
      return castBible.find(c =>
        c.character_id === id ||
        c.character_id?.toLowerCase() === idLower ||
        c.name?.toLowerCase() === idLower,
      );
    })
    .filter(Boolean) as CastBibleEntry[];

  if (identities.length === 0) return prompt;

  // Build cast description with ONLY populated fields. Earlier version wrote
  // " skin, , wearing " when fields were blank — and when clothing got
  // accidentally populated with mood/atmosphere text upstream it surfaced as
  // "wearing serene, peaceful atmosphere..." which made image models confused.
  const FORBIDDEN_CLOTHING = /\b(atmosphere|mood|tone|tones|lighting|light|warm natural|soft natural|peaceful|serene|cinematic|aesthetic)\b/i;
  const castDescription = identities
    .map(c => {
      const parts: string[] = [`${c.name}: ${c.age || "adult"} ${c.gender || ""}`.trim()];
      if (c.ethnicity && c.ethnicity !== "context-appropriate") parts.push(c.ethnicity);
      if (c.skin_tone && c.skin_tone.trim().length > 1) parts.push(`${c.skin_tone} skin`);
      if (c.hair && c.hair.trim().length > 1) parts.push(c.hair);
      // Wardrobe — skip if empty OR contaminated with mood/atmosphere text
      if (c.clothing && c.clothing.trim().length > 1 && !FORBIDDEN_CLOTHING.test(c.clothing)) {
        parts.push(`wearing ${c.clothing}`);
      }
      return parts.join(", ");
    })
    .join("; ");

  if (!castDescription || prompt.includes(castDescription)) return prompt;
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

    // Use image_intent from structure-story if available, else fall back to existing prompts
    const baseImageText = scene.image_intent
      ? `${scene.image_intent}. ${scene.image_prompt || scene.visual_prompt || ""}`
      : (scene.image_prompt || scene.visual_prompt || "");

    // Inject tag-specific cinematic modifier when scene_tag is set
    const tagModifier = scene.scene_tag ? TAG_MODIFIERS[scene.scene_tag] : null;
    const imageBase = tagModifier
      ? `${baseImageText} — ${tagModifier}`
      : baseImageText;

    // Inject cast bible into image/video prompts for identity consistency
    const imagePrompt = injectCastBibleIntoCaptions(
      imageBase,
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
