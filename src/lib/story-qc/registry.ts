// Supervisor registry — 23 supervisors per `update/ghs story structure/ghs_story_quality_control_layer_full_supervisor_plan.md`.
// Each supervisor is a small, focused critic. The orchestrator picks which to run.
//
// Why one registry: makes it cheap to add/remove supervisors. Each entry is self-describing —
// preconditions, dependencies, blocking-ness, LLM tier, prompt builder, parser.

import type { SupervisorDef, SupervisorReport } from "./types";

// Shared JSON-output parser. Every supervisor returns the same JSON envelope.
// {passed, score, blockingIssues, warnings, suggestedFixes, revisedData?}
function parseStandardJson(rawText: string): Omit<SupervisorReport, "supervisorName" | "runAt" | "durationMs" | "modelUsed"> {
  // Try to extract JSON object from response (LLMs often wrap in prose)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      passed: false,
      score: 0,
      blockingIssues: [],
      warnings: [`Supervisor LLM returned no JSON: ${rawText.slice(0, 200)}`],
      suggestedFixes: [],
    };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SupervisorReport>;
    return {
      passed: parsed.passed === true,
      score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 0,
      blockingIssues: Array.isArray(parsed.blockingIssues) ? parsed.blockingIssues.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      suggestedFixes: Array.isArray(parsed.suggestedFixes) ? parsed.suggestedFixes.map(String) : [],
      revisedData: typeof parsed.revisedData === "object" && parsed.revisedData !== null ? parsed.revisedData : undefined,
    };
  } catch (err) {
    return {
      passed: false,
      score: 0,
      blockingIssues: [],
      warnings: [`Supervisor JSON parse failed: ${err instanceof Error ? err.message : String(err)}`],
      suggestedFixes: [],
    };
  }
}

const STANDARD_OUTPUT_INSTRUCTION = `
Respond ONLY with a JSON object in this exact shape — no prose before or after:
{
  "passed": boolean,                    // false if ANY blockingIssue exists
  "score": 0..100,                      // your assessment score
  "blockingIssues": ["..."],            // must-fix; blocks downstream
  "warnings": ["..."],                  // should-fix; non-blocking
  "suggestedFixes": ["..."],            // concrete actions the writer can take
  "revisedData": { ... }                // optional: structured output (e.g. cast bible JSON)
}
`.trim();

export const SUPERVISORS: Record<string, SupervisorDef> = {
  story_intake_profiler: {
    name: "story_intake_profiler",
    description: "Reads raw user intake; produces structured story profile (genre, tone, audience, era).",
    requires: ["story"],
    blocking: true,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Story Intake Profiler. Read raw user intake and produce a profile.",
        user: `Story intake:\n${input.story}\n\nProduce profile JSON. ${STANDARD_OUTPUT_INSTRUCTION}\nrevisedData shape: {genre, tone, audience, era, language, themeTags}`,
      };
    },
    parse: parseStandardJson,
  },

  story_contract_generator: {
    name: "story_contract_generator",
    description: "From profile, produces the story contract (locked rules other supervisors enforce).",
    requires: ["story"],
    blocking: true,
    tier: "smart",
    dependsOn: ["story_intake_profiler"],
    buildPrompt(input) {
      return {
        system: "You are the Story Contract Generator. Produce a contract of locked rules.",
        user: `Story:\n${input.story}\n\nGenre: ${input.genre ?? "?"}\nProduce contract. ${STANDARD_OUTPUT_INSTRUCTION}\nrevisedData shape: {rules: string[], lockedFacts: {era, culture, language, audience}}`,
      };
    },
    parse: parseStandardJson,
  },

  story_screening: {
    name: "story_screening",
    description: "Screens for AUP violations, harmful content, deepfake / celebrity impersonation.",
    requires: ["story"],
    blocking: true,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Story Screening Supervisor. Block AUP violations, harmful content, celebrity impersonation, copyrighted IP.",
        user: `Story:\n${input.story}\n\nList ANY violations. ${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  prompt_simplifier: {
    name: "prompt_simplifier",
    description: "Simplifies overly-complex scene prompts to what image models actually obey.",
    requires: ["scenes"],
    blocking: false,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Prompt Simplifier. Rewrite scene prompts so image gen models will follow them.",
        user: `Scenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\nSimplify. ${STANDARD_OUTPUT_INSTRUCTION}\nrevisedData shape: {scenes: [{id, simplifiedPrompt}]}`,
      };
    },
    parse: parseStandardJson,
  },

  culture_country: {
    name: "culture_country",
    description: "Validates cultural / country / language consistency. Era + Culture lock.",
    requires: ["story"],
    blocking: true,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Culture & Country Supervisor. Catch anachronisms, wrong-culture artifacts, language drift.",
        user: `Story:\n${input.story}\n\nEra: ${input.era ?? "?"}\nCulture: ${input.culture ?? "?"}\nLanguage: ${input.language ?? "?"}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  cast_bible_generator: {
    name: "cast_bible_generator",
    description: "Builds the canonical cast bible — each character with locked identity fields.",
    requires: ["story"],
    blocking: true,
    tier: "smart",
    dependsOn: ["story_intake_profiler"],
    buildPrompt(input) {
      return {
        system: "You are the Cast Bible Generator. Extract every character + lock their identity.",
        user: `Story:\n${input.story}\n\n${STANDARD_OUTPUT_INSTRUCTION}\nrevisedData shape: {cast: [{name, age, gender, ethnicity, appearance, wardrobe, voice, role}]}`,
      };
    },
    parse: parseStandardJson,
  },

  cast_checking: {
    name: "cast_checking",
    description: "Verifies cast bible is internally consistent and matches story references.",
    requires: ["story", "characters"],
    blocking: true,
    tier: "fast",
    dependsOn: ["cast_bible_generator"],
    buildPrompt(input) {
      return {
        system: "You are the Cast Checking Supervisor. Verify cast bible matches story.",
        user: `Story:\n${input.story}\n\nCast:\n${JSON.stringify(input.characters ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  prompt_vs_cast_consistency: {
    name: "prompt_vs_cast_consistency",
    description: "Catches scene prompts that contradict cast bible (e.g. wrong age, wrong wardrobe).",
    requires: ["scenes", "characters"],
    blocking: true,
    tier: "fast",
    dependsOn: ["cast_bible_generator"],
    buildPrompt(input) {
      return {
        system: "You are the Prompt-vs-Cast Consistency Supervisor. Flag scene prompts that contradict cast bible.",
        user: `Cast:\n${JSON.stringify(input.characters ?? [], null, 2)}\n\nScenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  scene_demarcator_timing: {
    name: "scene_demarcator_timing",
    description: "Validates scene boundaries + timing total = target duration.",
    requires: ["scenes", "targetDurationSec"],
    blocking: true,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Scene Demarcator & Timing Supervisor. Verify scene durations sum to target.",
        user: `Scenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\nTarget total: ${input.targetDurationSec ?? "?"}s\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  scene_density: {
    name: "scene_density",
    description: "Catches scenes that try to pack too much action into too little time.",
    requires: ["scenes"],
    blocking: false,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Scene Density Supervisor. Flag overloaded scenes.",
        user: `Scenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  emotion_intensifier: {
    name: "emotion_intensifier",
    description: "Suggests emotional beats / cues to strengthen weak scenes. Non-blocking.",
    requires: ["scenes"],
    blocking: false,
    tier: "smart",
    buildPrompt(input) {
      return {
        system: "You are the Emotion Intensifier. Suggest where to add emotional weight.",
        user: `Scenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  music_and_sound: {
    name: "music_and_sound",
    description: "Validates music/SFX choices match scene mood + genre.",
    requires: ["scenes", "music"],
    blocking: false,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Music & Sound Supervisor.",
        user: `Music plan:\n${JSON.stringify(input.music ?? [], null, 2)}\n\nScenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  music_continuity: {
    name: "music_continuity",
    description: "Catches jarring music transitions between scenes.",
    requires: ["music"],
    blocking: false,
    tier: "fast",
    dependsOn: ["music_and_sound"],
    buildPrompt(input) {
      return {
        system: "You are the Music Continuity Supervisor.",
        user: `Music timeline:\n${JSON.stringify(input.music ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  dialogue_and_voice: {
    name: "dialogue_and_voice",
    description: "Validates dialogue lines + voice assignments per character.",
    requires: ["scenes", "characters"],
    blocking: true,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Dialogue & Voice Supervisor.",
        user: `Characters:\n${JSON.stringify(input.characters ?? [], null, 2)}\n\nScenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  subtitle_style: {
    name: "subtitle_style",
    description: "Validates subtitle styling appropriate for genre + audience.",
    requires: ["subtitleConfig"],
    blocking: false,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Subtitle Style Supervisor.",
        user: `Subtitle config:\n${JSON.stringify(input.subtitleConfig ?? {}, null, 2)}\nGenre: ${input.genre ?? "?"}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  short_story: {
    name: "short_story",
    description: "Validates short-form pacing (< 5 min target).",
    requires: ["story", "targetDurationSec"],
    blocking: false,
    tier: "fast",
    shouldSkip: (input) => (input.targetDurationSec ?? 0) > 300 ? "not a short-form story (>5min)" : null,
    buildPrompt(input) {
      return {
        system: "You are the Short Story Supervisor — pacing for <5 min videos.",
        user: `Story:\n${input.story}\n\nTarget: ${input.targetDurationSec ?? "?"}s\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  long_story: {
    name: "long_story",
    description: "Validates long-form pacing (> 5 min target).",
    requires: ["story", "targetDurationSec"],
    blocking: false,
    tier: "smart",
    shouldSkip: (input) => (input.targetDurationSec ?? 0) <= 300 ? "not a long-form story (<=5min)" : null,
    buildPrompt(input) {
      return {
        system: "You are the Long Story Supervisor — pacing for >5 min videos.",
        user: `Story:\n${input.story}\n\nTarget: ${input.targetDurationSec ?? "?"}s\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  location_and_environment: {
    name: "location_and_environment",
    description: "Validates location descriptions are visualizable + culturally accurate.",
    requires: ["scenes"],
    blocking: false,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Location & Environment Supervisor.",
        user: `Scenes (focus on location text):\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\nCulture: ${input.culture ?? "?"}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  costume_and_props: {
    name: "costume_and_props",
    description: "Validates costume + props match era + culture + character.",
    requires: ["scenes", "characters"],
    blocking: false,
    tier: "fast",
    buildPrompt(input) {
      return {
        system: "You are the Costume & Props Supervisor.",
        user: `Characters:\n${JSON.stringify(input.characters ?? [], null, 2)}\n\nEra: ${input.era ?? "?"}\nCulture: ${input.culture ?? "?"}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  continuity: {
    name: "continuity",
    description: "Cross-scene continuity (wardrobe, location, props persist appropriately).",
    requires: ["scenes"],
    blocking: true,
    tier: "smart",
    dependsOn: ["cast_bible_generator", "costume_and_props"],
    buildPrompt(input) {
      return {
        system: "You are the Continuity Supervisor. Flag wardrobe/prop/location breaks across scenes.",
        user: `Scenes in order:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },

  scene_prompt_builder: {
    name: "scene_prompt_builder",
    description: "Produces the final image-gen prompt per scene (after all other supervisors).",
    requires: ["scenes", "characters"],
    blocking: true,
    tier: "smart",
    dependsOn: ["prompt_vs_cast_consistency", "continuity", "location_and_environment"],
    buildPrompt(input) {
      return {
        system: "You are the Scene Prompt Builder. Produce the final image-gen prompt per scene.",
        user: `Scenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\nCharacters:\n${JSON.stringify(input.characters ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}\nrevisedData shape: {prompts: [{sceneId, finalPrompt, negativePrompt}]}`,
      };
    },
    parse: parseStandardJson,
  },

  ai_provider_compatibility: {
    name: "ai_provider_compatibility",
    description: "Picks AI providers compatible with planned prompts (Flux vs Kling vs Wan vs FAL).",
    requires: ["scenes"],
    blocking: false,
    tier: "fast",
    dependsOn: ["scene_prompt_builder"],
    buildPrompt(input) {
      return {
        system: "You are the AI Provider Compatibility Supervisor.",
        user: `Scenes:\n${JSON.stringify(input.scenes ?? [], null, 2)}\n\n${STANDARD_OUTPUT_INSTRUCTION}\nrevisedData shape: {recommendations: [{sceneId, preferredImageModel, preferredVideoModel, reason}]}`,
      };
    },
    parse: parseStandardJson,
  },

  final_assembly_gatekeeper: {
    name: "final_assembly_gatekeeper",
    description: "Final gate — all previous supervisors must pass before assembly is allowed.",
    requires: ["story", "scenes", "characters"],
    blocking: true,
    tier: "fast",
    dependsOn: ["scene_prompt_builder", "continuity", "dialogue_and_voice", "scene_demarcator_timing"],
    buildPrompt(input) {
      return {
        system: "You are the Final Assembly Gatekeeper. Verify the project is ready to render.",
        user: `Story:\n${input.story?.slice(0, 800) ?? ""}\n\nScenes: ${input.scenes?.length ?? 0}\nCharacters: ${input.characters?.length ?? 0}\n\n${STANDARD_OUTPUT_INSTRUCTION}`,
      };
    },
    parse: parseStandardJson,
  },
};

export function allSupervisors(): SupervisorDef[] {
  return Object.values(SUPERVISORS);
}

export function getSupervisor(name: string): SupervisorDef | null {
  return SUPERVISORS[name] ?? null;
}
