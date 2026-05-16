// Story Quality Control Layer — main entry point
// Full 23-supervisor pipeline per §25 of GHS Story QC spec

export { buildStoryContract } from "./story-contract";
export { runStoryScreening } from "./story-screening";
export { runPromptSimplifier } from "./prompt-simplifier";
export { runCultureCheck } from "./culture-supervisor";
export { generateCastBible } from "./cast-bible";
export { runCastCheck } from "./cast-checking";
export { runPromptCastValidator } from "./prompt-cast-validator";
export { demarcateScenes } from "./scene-demarcator";
export { runSceneDensityCheck } from "./scene-density";
export { runEmotionIntensifier } from "./emotion-intensifier";
export { runMusicSupervisor } from "./music-supervisor";
export { runMusicContinuityCheck } from "./music-continuity";
export { runDialogueVoiceCheck } from "./dialogue-voice-supervisor";
export { runSubtitleStyleCheck } from "./subtitle-style-supervisor";
export { runShortStorySupervisor } from "./short-story-supervisor";
export { runLongStorySupervisor } from "./long-story-supervisor";
export { runLocationEnvironmentCheck } from "./location-environment-supervisor";
export { runCostumePropsCheck } from "./costume-props-supervisor";
export { runContinuityCheck } from "./continuity-supervisor";
export { runScenePromptBuilder } from "./scene-prompt-builder";
export { runProviderCompatibilityCheck } from "./provider-compatibility";
export { runFinalGatekeeper } from "./final-gatekeeper";

export type {
  StoryContract,
  CastBibleEntry,
  ScenePlan,
  ShotPlan,
  SupervisorResult,
  StoryQCInput,
  StoryType,
  EmotionalIntensity,
  LanguageLevel,
  SubtitleStyle,
  GenerationMode,
  EmotionCurve,
  MusicMap,
  ContinuityLedger,
} from "./types";

import { runStoryScreening } from "./story-screening";
import { runPromptSimplifier } from "./prompt-simplifier";
import { runCultureCheck } from "./culture-supervisor";
import { generateCastBible } from "./cast-bible";
import { runCastCheck } from "./cast-checking";
import { runPromptCastValidator } from "./prompt-cast-validator";
import { demarcateScenes } from "./scene-demarcator";
import { runSceneDensityCheck } from "./scene-density";
import { runEmotionIntensifier } from "./emotion-intensifier";
import { runMusicSupervisor } from "./music-supervisor";
import { runMusicContinuityCheck } from "./music-continuity";
import { runDialogueVoiceCheck } from "./dialogue-voice-supervisor";
import { runSubtitleStyleCheck } from "./subtitle-style-supervisor";
import { runShortStorySupervisor } from "./short-story-supervisor";
import { runLongStorySupervisor } from "./long-story-supervisor";
import { runLocationEnvironmentCheck } from "./location-environment-supervisor";
import { runCostumePropsCheck } from "./costume-props-supervisor";
import { runContinuityCheck } from "./continuity-supervisor";
import { runScenePromptBuilder } from "./scene-prompt-builder";
import { runProviderCompatibilityCheck } from "./provider-compatibility";
import { runFinalGatekeeper } from "./final-gatekeeper";

import type {
  StoryContract,
  CastBibleEntry,
  ScenePlan,
  SupervisorResult,
  StoryQCInput,
} from "./types";

export interface FullPipelineResult {
  contract: StoryContract;
  castBible: CastBibleEntry[];
  scenes: ScenePlan[];
  supervisorResults: Record<string, SupervisorResult>;
  gatekeeper: SupervisorResult<{
    scores: Record<string, number>;
    readyForGeneration: boolean;
    scenes: ScenePlan[];
  }>;
  readyForGeneration: boolean;
}

/**
 * Full 23-supervisor GHS Story Quality Control pipeline.
 *
 * Stage order (per §25 of GHS Story QC spec):
 *  1.  Story Screening        — validates raw story text
 *  2.  Prompt Simplifier      — checks language clarity / voiceover word count
 *  3.  Culture Check          — validates cultural/geographic consistency
 *  4.  Cast Bible Generation  — extracts character identities (CH01/CH02...)
 *  5.  Cast Checking          — validates story text vs Cast Bible
 *  6.  Prompt–Cast Validator  — validates visual prompts vs Cast Bible
 *  7.  Scene Demarcation      — splits story into timed ScenePlan objects
 *  8.  Scene Density Check    — validates action fits scene duration
 *  9.  Emotion Intensifier    — builds emotion arc, enhances prompts
 * 10.  Music Supervisor       — assigns music cues per scene
 * 11.  Music Continuity       — detects wrongly repeated / mismatched music
 * 12.  Dialogue & Voice       — checks dialogue fits duration, voice matches character
 * 13.  Subtitle Style         — validates subtitle style matches story type
 * 14.  Short Story Supervisor — enforces discipline for short_story (conditional)
 * 15.  Long Story Supervisor  — enforces act structure for long_story/movie (conditional)
 * 16.  Location & Environment — checks country/cultural realism in locations
 * 17.  Costume & Props        — checks clothing and props match culture/context
 * 18.  Continuity Supervisor  — tracks character/time/prop continuity across scenes
 * 19.  Scene Prompt Builder   — finalizes each scene's complete prompt package
 * 20.  Provider Compatibility — recommends generation method per scene
 * 21.  Final Gatekeeper       — aggregates all results into pass/fail
 */
export async function runFullStoryQCPipeline(
  input: StoryQCInput
): Promise<FullPipelineResult> {
  const { storyText, contract } = input;
  const supervisorResults: Record<string, SupervisorResult> = {};

  // ── Stage 1: Story Screening ──────────────────────────────────────────────
  const screeningResult = runStoryScreening(storyText, contract);
  supervisorResults["story_quality"] = screeningResult;

  // ── Stage 2: Prompt Simplifier ───────────────────────────────────────────
  const simplifierResult = runPromptSimplifier(storyText, contract);
  supervisorResults["language_clarity"] = simplifierResult;

  // ── Stage 3: Culture Check ────────────────────────────────────────────────
  // Use provided castBible for culture check if available (pre-loaded project)
  let castBible: CastBibleEntry[] = input.castBible ?? [];
  const cultureResult = runCultureCheck(storyText, castBible, contract);
  supervisorResults["culture_match"] = cultureResult;

  // ── Stage 4: Cast Bible Generation ───────────────────────────────────────
  let castBibleResult: SupervisorResult<{ castBible: CastBibleEntry[] }>;
  if (castBible.length > 0) {
    castBibleResult = {
      passed: true,
      score: 100,
      blockingIssues: [],
      warnings: ["Cast Bible provided by caller — skipping AI generation."],
      suggestedFixes: [],
      revisedData: { castBible },
      metadata: { providedByUser: true, characterCount: castBible.length },
    };
  } else {
    castBibleResult = await generateCastBible(storyText, contract);
    castBible = castBibleResult.revisedData?.castBible ?? [];
  }
  supervisorResults["cast_extraction"] = castBibleResult;

  // ── Stage 5: Cast Checking ────────────────────────────────────────────────
  // Use provided scenes or empty array (scenes not yet demarcated at this stage)
  const castCheckResult = runCastCheck(input.scenes ?? [], castBible);
  supervisorResults["cast_consistency"] = castCheckResult;

  // ── Stage 6: Prompt–Cast Validator ────────────────────────────────────────
  // Validate any pre-existing scene prompts; new scenes validated after demarcation
  const promptCastResult = runPromptCastValidator(input.scenes ?? [], castBible);
  supervisorResults["prompt_cast_match"] = promptCastResult;

  // ── Stage 7: Scene Demarcation ────────────────────────────────────────────
  let scenes: ScenePlan[];
  let demarcationResult: SupervisorResult<{ scenes: ScenePlan[] }>;
  if (input.scenes && input.scenes.length > 0) {
    scenes = input.scenes;
    demarcationResult = {
      passed: true,
      score: 100,
      blockingIssues: [],
      warnings: ["Scenes provided by caller — skipping AI demarcation."],
      suggestedFixes: [],
      revisedData: { scenes },
      metadata: { providedByUser: true, sceneCount: scenes.length },
    };
  } else {
    demarcationResult = await demarcateScenes(storyText, contract, castBible);
    scenes = demarcationResult.revisedData?.scenes ?? [];
  }
  supervisorResults["scene_demarcation"] = demarcationResult;

  // Re-run prompt–cast validator on freshly demarcated scenes
  if (!input.scenes || input.scenes.length === 0) {
    const promptCastResult2 = runPromptCastValidator(scenes, castBible);
    supervisorResults["prompt_cast_match"] = {
      ...promptCastResult2,
      warnings: [...promptCastResult.warnings, ...promptCastResult2.warnings],
      blockingIssues: [...promptCastResult.blockingIssues, ...promptCastResult2.blockingIssues],
    };
  }

  // ── Stage 8: Scene Density ────────────────────────────────────────────────
  const densityResult = runSceneDensityCheck(scenes, contract);
  supervisorResults["timing"] = densityResult;

  // ── Stage 9: Emotion Intensifier ─────────────────────────────────────────
  const emotionResult = runEmotionIntensifier(scenes, contract);
  supervisorResults["emotion_arc"] = emotionResult;
  if (emotionResult.revisedData?.enhancedScenes) {
    scenes = emotionResult.revisedData.enhancedScenes;
  }

  // ── Stage 10: Music Supervisor ────────────────────────────────────────────
  const musicResult = runMusicSupervisor(scenes, contract);
  supervisorResults["audio_music"] = musicResult;
  if (musicResult.revisedData?.updatedScenes) {
    scenes = musicResult.revisedData.updatedScenes;
  }

  // ── Stage 11: Music Continuity ────────────────────────────────────────────
  const musicContinuityResult = runMusicContinuityCheck(scenes, contract);
  supervisorResults["music_continuity"] = musicContinuityResult;

  // ── Stage 12: Dialogue & Voice ────────────────────────────────────────────
  const dialogueResult = runDialogueVoiceCheck(scenes, castBible, contract);
  supervisorResults["dialogue_voice"] = dialogueResult;

  // ── Stage 13: Subtitle Style ──────────────────────────────────────────────
  const subtitleResult = runSubtitleStyleCheck(scenes, contract);
  supervisorResults["subtitle_style"] = subtitleResult;
  if (subtitleResult.revisedData?.updatedScenes) {
    scenes = subtitleResult.revisedData.updatedScenes;
  }

  // ── Stage 14: Short Story Supervisor (conditional) ────────────────────────
  const shortStoryResult = runShortStorySupervisor(scenes, storyText, contract);
  supervisorResults["short_story"] = shortStoryResult;

  // ── Stage 15: Long Story Supervisor (conditional) ─────────────────────────
  const longStoryResult = runLongStorySupervisor(scenes, storyText, contract);
  supervisorResults["long_story"] = longStoryResult;

  // ── Stage 16: Location & Environment ─────────────────────────────────────
  const locationResult = runLocationEnvironmentCheck(scenes, contract);
  supervisorResults["location_environment"] = locationResult;

  // ── Stage 17: Costume & Props ─────────────────────────────────────────────
  const costumeResult = runCostumePropsCheck(scenes, castBible, contract);
  supervisorResults["costume_props"] = costumeResult;

  // ── Stage 18: Continuity Supervisor ──────────────────────────────────────
  const continuityResult = runContinuityCheck(scenes, castBible);
  supervisorResults["continuity"] = continuityResult;

  // ── Stage 19: Scene Prompt Builder ───────────────────────────────────────
  const promptBuilderResult = runScenePromptBuilder(scenes, castBible, contract);
  supervisorResults["prompt_build"] = promptBuilderResult;
  if (promptBuilderResult.revisedData?.builtScenes) {
    scenes = promptBuilderResult.revisedData.builtScenes;
  }

  // ── Stage 20: Provider Compatibility ─────────────────────────────────────
  const providerResult = runProviderCompatibilityCheck(scenes, contract);
  supervisorResults["provider_compat"] = providerResult;
  if (providerResult.revisedData?.updatedScenes) {
    scenes = providerResult.revisedData.updatedScenes;
  }

  // ── Stage 21: Final Gatekeeper ────────────────────────────────────────────
  // Pass core scoring supervisors in canonical order
  // Order must match CATEGORY_LABELS in final-gatekeeper.ts exactly:
  // story_quality, cast_extraction, culture_match, cast_consistency, scene_demarcation,
  // timing, emotion_arc, audio_music, continuity, provider_compat
  const gatekeeperOrdered: SupervisorResult[] = [
    supervisorResults["story_quality"],
    supervisorResults["cast_extraction"],
    supervisorResults["culture_match"],
    supervisorResults["cast_consistency"],
    supervisorResults["scene_demarcation"],
    supervisorResults["timing"],
    supervisorResults["emotion_arc"],
    supervisorResults["audio_music"],
    supervisorResults["continuity"],
    supervisorResults["provider_compat"],
  ].filter(Boolean) as SupervisorResult[];

  const gatekeeper = runFinalGatekeeper(gatekeeperOrdered, scenes, contract);
  const readyForGeneration = gatekeeper.revisedData?.readyForGeneration ?? false;

  return {
    contract,
    castBible,
    scenes,
    supervisorResults,
    gatekeeper,
    readyForGeneration,
  };
}
