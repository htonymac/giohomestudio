// GioHomeStudio — Local LLM Supervisor / Orchestrator
// Uses Ollama (qwen2.5:14b) to analyze prompts and produce an OrchestrationPlan.
// Falls back to rule-based analysis if Ollama is unavailable.
//
// The supervisor is the brain of Auto Mode — it reads the raw prompt + user controls
// and decides: what to generate, how, with what settings.

import type { SpeechStyle } from "@/types/providers";
import { callLLM } from "@/lib/llm";

export interface OrchestrationPlan {
  // Content analysis
  contentIntent: string;          // one-line summary of what this content is about
  inferredSubjectType: string;    // "human" | "animal" | "product" | "scene_only"
  inferredVideoType: string;      // "cinematic" | "realistic" | "social_short" | "storytelling" | "ad_promo"
  inferredVisualStyle: string;    // "photorealistic" | "cinematic_dark" | "stylized" | "bright_commercial"
  inferredAspectRatio: string;    // "9:16" | "16:9" | "1:1"

  // Audio analysis
  inferredMusicMood: string;      // "epic" | "war" | "rain" | "heavy_rain" | "nature" | "calm" | "emotional" | "action" | "suspense" | "dance" | "upbeat" | "dramatic"
  inferredMusicGenre?: string;    // "orchestral" | "ambient" | "electronic" | "acoustic" | "hip_hop"
  inferredNarrationNeed: boolean; // should voice be generated?
  inferredMusicNeed: boolean;     // should music be added?

  // Audio drama layer
  inferredSFXNeed: boolean;                  // should sound effects be added?
  inferredSoundEvents: string[];             // e.g. ["thunder", "rain", "crowd_cheer", "footsteps"]
  inferredDialogueStructure: "narration_only" | "dialogue_present" | "mixed";
  inferredSpeakerCount: number;              // 1 = narrator only, 2+ = multi-voice dialogue

  // Scene interpretation layer (Pass B) — all optional, set by detectScene*() functions
  sceneType?: "dialogue" | "action" | "horror" | "romance" | "suspense" | "narration" | "flashback" | "climax";
  emotionalTone?: "neutral" | "tense" | "sorrowful" | "triumphant" | "fearful" | "joyful" | "angry";
  speechStyle?: SpeechStyle;
  tensionLevel?: 0 | 1 | 2 | 3;             // 0 = calm, 3 = peak tension
  environmentType?: "indoor" | "outdoor" | "vehicle" | "underwater" | "space" | "crowd";
  duckingPlan?: "none" | "light" | "heavy"; // how much to duck music under dialogue
  pauseStrategy?: "natural" | "dramatic" | "fast_cut";
  ambienceNeed?: boolean;                    // should ambient background audio be added?
  recommendedAudioMode?: "voice_only" | "voice_music" | "voice_sfx_music" | "full_drama";

  // Identity / casting hints
  castingHints?: {
    ethnicity?: string;
    gender?: string;
    culture?: string;
  };

  // Provider recommendations
  recommendedVideoProvider: string; // "runway" | "kling" | "mock_video"
  fallbackPlan: string;

  // Metadata
  confidence: number;           // 0.0-1.0
  supervisedBy: "ollama" | "rule_based";
  notes: string[];
  generatedAt: string;          // ISO timestamp
}


// SFX detection — maps keyword patterns to sound event names
const SFX_EVENT_RULES: Array<{ pattern: RegExp; event: string }> = [
  { pattern: /thunder|lightning|storm/i, event: "thunder" },
  { pattern: /heavy rain|downpour|pouring rain|torrential/i, event: "rain_heavy" },
  { pattern: /rain|drizzle|shower|puddle|wet street/i, event: "rain_light" },
  { pattern: /wind|howl|gust|breeze/i, event: "wind" },
  { pattern: /crowd|audience|people cheer|stadium|rally/i, event: "crowd_cheer" },
  { pattern: /crowd murmur|busy street|marketplace|market/i, event: "crowd_murmur" },
  { pattern: /gunshot|gun fire|pistol|rifle|shooting/i, event: "gunshot" },
  { pattern: /explosion|bomb|blast|detonation/i, event: "explosion" },
  { pattern: /sword|blade|clash|duel|fight|battle/i, event: "sword_clash" },
  { pattern: /footstep|walking|running|chase/i, event: "footsteps" },
  { pattern: /fire|flame|burning|blaze/i, event: "fire_crackling" },
  { pattern: /ocean|sea|wave|beach|shore/i, event: "ocean_waves" },
  { pattern: /forest|jungle|bird|wildlife|nature ambience/i, event: "forest_ambience" },
  { pattern: /city|urban|traffic|car|engine|horn/i, event: "city_traffic" },
  { pattern: /church|bell|chime|clock tower/i, event: "church_bell" },
  { pattern: /horror|ghost|haunted|scream|terror/i, event: "horror_sting" },
  { pattern: /dog|bark|howl/i, event: "dog_bark" },
  { pattern: /door|knock|creaking/i, event: "door_creak" },
  { pattern: /horse|gallop|hoofbeat/i, event: "horse_gallop" },
  // Vehicle
  { pattern: /driving|car ride|road trip|inside the car|in the car|vehicle/i, event: "cabin_ambience" },
  { pattern: /engine|motor humm?ing|idling|engine noise/i, event: "engine_hum" },
  { pattern: /road noise|tyre|tire on|highway sound/i, event: "road_noise" },
];

export function detectSoundEventsFromText(text: string): string[] {
  const found: string[] = [];
  for (const rule of SFX_EVENT_RULES) {
    if (rule.pattern.test(text) && !found.includes(rule.event)) {
      found.push(rule.event);
    }
  }
  return found;
}

// Dialogue structure detection
export function detectDialogueStructure(text: string): {
  structure: "narration_only" | "dialogue_present" | "mixed";
  speakerCount: number;
} {
  // Detect quoted speech with speaker attribution: `JOHN: "text"` or `John: "text"`
  const speakerPattern = /^[A-Z][A-Z\s]{1,20}:\s*["""]/m;
  const altSpeakerPattern = /\b[A-Z][a-z]+:\s*["""]/;
  const hasDialogue = speakerPattern.test(text) || altSpeakerPattern.test(text) ||
    /\[NARRATOR\]/i.test(text) || /narrator:/i.test(text);

  if (!hasDialogue) return { structure: "narration_only", speakerCount: 1 };

  // Count unique speaker labels
  const speakerMatches = text.match(/^([A-Z][A-Z\s]{1,20}):/gm) ?? [];
  const uniqueSpeakers = new Set(speakerMatches.map(s => s.replace(":", "").trim()));
  const count = Math.max(uniqueSpeakers.size, 1);

  const structure = count > 1 ? "dialogue_present" : "mixed";
  return { structure, speakerCount: count };
}

const MUSIC_MOOD_RULES: Array<{ pattern: RegExp; mood: string }> = [
  { pattern: /war|battle|fight|soldier|military|combat|conflict|attack|weapon/i, mood: "war" },
  { pattern: /heavy rain|downpour|pouring|storm flood/i, mood: "heavy_rain" },
  { pattern: /rain|drizzle|shower|wet street|puddle|umbrella/i, mood: "rain" },
  { pattern: /nature|forest|jungle|bird|wildlife|outdoor|mountain|river|lake/i, mood: "nature" },
  { pattern: /calm|peaceful|relax|gentle|quiet|serene|meditat|slow|soft/i, mood: "calm" },
  { pattern: /emotional|sad|cry|tear|grief|loss|mourn|heartbreak|lonely/i, mood: "emotional" },
  { pattern: /suspense|thriller|mystery|dark|tense|horror|afraid|fear/i, mood: "suspense" },
  { pattern: /action|chase|race|speed|fast|intense|rush|explosion|crash/i, mood: "action" },
  { pattern: /dance|party|club|celebrate|disco|groove|bounce/i, mood: "dance" },
  { pattern: /upbeat|cheerful|happy|joy|fun|bright|energetic|pop|lively/i, mood: "upbeat" },
  { pattern: /dramatic|powerful|intense|orchestra|grand|climax|powerful/i, mood: "dramatic" },
  { pattern: /epic|hero|glory|triumph|legend|kingdom|cinematic|adventure/i, mood: "epic" },
];

export function inferMusicMoodFromPrompt(prompt: string): string {
  for (const rule of MUSIC_MOOD_RULES) {
    if (rule.pattern.test(prompt)) return rule.mood;
  }
  return "epic"; // default
}

// ── Scene Interpretation Functions (Pass B) ──────────────────────────────────

export function detectSceneType(text: string): OrchestrationPlan["sceneType"] {
  const p = text.toLowerCase();
  if (/flashback|memory|years ago|back then|remember when/.test(p)) return "flashback";
  if (/climax|final moment|turning point|it all comes down|showdown/.test(p)) return "climax";
  if (/horror|ghost|scream|haunted|terror|creature|monster/.test(p)) return "horror";
  if (/suspense|tension|waiting|silence|stalking|creeping/.test(p)) return "suspense";
  if (/romance|love|tender|kiss|together|heart|darling|intimate/.test(p)) return "romance";
  if (/battle|fight|explosion|chase|attack|combat|war/.test(p)) return "action";
  if (/said|replied|asked|answered|argued|shouted|whispered/.test(p)) return "dialogue";
  return "narration";
}

export function detectEmotionalTone(text: string): OrchestrationPlan["emotionalTone"] {
  const p = text.toLowerCase();
  if (/rage|fury|anger|shout|scream|yell|furious|enraged/.test(p)) return "angry";
  if (/fear|terrified|scared|dread|horror|panic/.test(p)) return "fearful";
  if (/grief|mourn|sad|tears|cry|sob|loss|heartbreak/.test(p)) return "sorrowful";
  if (/triumph|victory|glory|won|celebrate|cheer|proud/.test(p)) return "triumphant";
  if (/tense|silent|still|holding breath|wait|dread/.test(p)) return "tense";
  if (/joy|happy|laugh|smile|delight|fun|playful|wonderful/.test(p)) return "joyful";
  return "neutral";
}

export function detectSpeechStyle(
  text: string,
  sceneType: OrchestrationPlan["sceneType"],
  emotionalTone: OrchestrationPlan["emotionalTone"]
): SpeechStyle {
  const p = text.toLowerCase();
  if (/\[whisper|whispered|spoke softly|barely audible|hushed/.test(p)) return "whisper";
  if (sceneType === "horror" || sceneType === "suspense" || emotionalTone === "fearful") return "whisper";
  if (emotionalTone === "sorrowful" || sceneType === "romance") return "emotional";
  if (emotionalTone === "angry" || emotionalTone === "triumphant") return "commanding";
  if (/tremble|trembling|shaking|quivering|voice broke/.test(p)) return "trembling";
  return "normal";
}

export function detectTensionLevel(text: string): 0 | 1 | 2 | 3 {
  const p = text.toLowerCase();
  const high = /explosion|attack|gunshot|horror|terror|battle|climax|scream|final/.test(p);
  const med  = /suspense|chase|tense|stalking|danger|threat|fear/.test(p);
  const low  = /mystery|uncertain|unease|shadow|quiet/.test(p);
  if (high) return 3;
  if (med)  return 2;
  if (low)  return 1;
  return 0;
}

export function detectEnvironmentType(text: string): OrchestrationPlan["environmentType"] {
  const p = text.toLowerCase();
  if (/underwater|beneath the waves|ocean floor|submerged/.test(p)) return "underwater";
  if (/space|orbit|zero gravity|spacecraft|galaxy|stars/.test(p)) return "space";
  if (/stadium|crowd|arena|rally|audience/.test(p)) return "crowd";
  if (/driving|car ride|inside the car|vehicle|road trip/.test(p)) return "vehicle";
  if (/outdoor|forest|beach|open field|mountain|street|park/.test(p)) return "outdoor";
  return "indoor";
}

export function detectDuckingPlan(
  tensionLevel: number,
  speakerCount: number
): OrchestrationPlan["duckingPlan"] {
  if (speakerCount > 1 || tensionLevel >= 2) return "heavy";
  if (speakerCount === 1 && tensionLevel >= 1) return "light";
  return "none";
}

export function detectPauseStrategy(
  sceneType: OrchestrationPlan["sceneType"],
  emotionalTone: OrchestrationPlan["emotionalTone"]
): OrchestrationPlan["pauseStrategy"] {
  if (sceneType === "action") return "fast_cut";
  if (sceneType === "horror" || sceneType === "suspense" || sceneType === "climax") return "dramatic";
  return "natural";
}

export function detectRecommendedAudioMode(
  sfxNeed: boolean,
  speakerCount: number,
  tensionLevel: number
): OrchestrationPlan["recommendedAudioMode"] {
  if (sfxNeed && speakerCount > 1 && tensionLevel >= 2) return "full_drama";
  if (sfxNeed && speakerCount > 0) return "voice_sfx_music";
  if (speakerCount > 0) return "voice_music";
  return "voice_only";
}

// Run all Pass B scene analysis and return partial plan fields
export function analyzeScene(prompt: string, speakerCount: number, sfxNeed: boolean): Partial<OrchestrationPlan> {
  const sceneType     = detectSceneType(prompt);
  const emotionalTone = detectEmotionalTone(prompt);
  const speechStyle   = detectSpeechStyle(prompt, sceneType, emotionalTone);
  const tensionLevel  = detectTensionLevel(prompt);
  const environmentType = detectEnvironmentType(prompt);
  const duckingPlan   = detectDuckingPlan(tensionLevel, speakerCount);
  const pauseStrategy = detectPauseStrategy(sceneType, emotionalTone);
  const ambienceNeed  = environmentType !== "indoor" || tensionLevel >= 1;
  const recommendedAudioMode = detectRecommendedAudioMode(sfxNeed, speakerCount, tensionLevel);

  return {
    sceneType,
    emotionalTone,
    speechStyle,
    tensionLevel,
    environmentType,
    duckingPlan,
    pauseStrategy,
    ambienceNeed,
    recommendedAudioMode,
  };
}

function ruleBasedPlan(prompt: string, controls: Partial<OrchestrationPlan> = {}): OrchestrationPlan {
  const p = prompt.toLowerCase();

  const subjectType =
    /person|people|man|woman|child|human|character|actor|model/.test(p) ? "human" :
    /animal|dog|cat|bird|lion|elephant/.test(p) ? "animal" :
    /product|item|object|gadget|device|bottle|shoe|bag/.test(p) ? "product" : "human";

  const videoType =
    /ad|commercial|promo|product/.test(p) ? "ad_promo" :
    /news|documentary|report/.test(p) ? "realistic" :
    /short|reel|tiktok|clip|viral/.test(p) ? "social_short" :
    /story|narrat|episode|scene/.test(p) ? "storytelling" : "cinematic";

  const visualStyle =
    /dark|noir|shadow|midnight/.test(p) ? "cinematic_dark" :
    /bright|colorful|vibrant|commercial/.test(p) ? "bright_commercial" :
    /anime|cartoon|animated/.test(p) ? "stylized" : "photorealistic";

  const aspectRatio =
    /landscape|wide|16.9|youtube/.test(p) ? "16:9" :
    /square|1.1/.test(p) ? "1:1" : "9:16";

  const musicMood = inferMusicMoodFromPrompt(prompt);
  const soundEvents = detectSoundEventsFromText(prompt);
  const { structure: dialogueStructure, speakerCount } = detectDialogueStructure(prompt);
  const sceneAnalysis = analyzeScene(prompt, speakerCount, soundEvents.length > 0);

  const castingHints: OrchestrationPlan["castingHints"] = {};
  if (/africa|nigeri|ghana|kenya|lagos|nairobi|african/.test(p)) {
    castingHints.ethnicity = "african";
    castingHints.culture = "african";
  } else if (/arab|middle east|dubai|egypt|morocco/.test(p)) {
    castingHints.ethnicity = "arab";
    castingHints.culture = "arab";
  } else if (/asian|china|japan|korea|india/.test(p)) {
    castingHints.ethnicity = "asian";
    castingHints.culture = "asian";
  }

  return {
    contentIntent: `Video content about: ${prompt.slice(0, 80)}`,
    inferredSubjectType: subjectType,
    inferredVideoType: videoType,
    inferredVisualStyle: visualStyle,
    inferredAspectRatio: aspectRatio,
    inferredMusicMood: musicMood,
    inferredNarrationNeed: true,
    inferredMusicNeed: true,
    inferredSFXNeed: soundEvents.length > 0,
    inferredSoundEvents: soundEvents,
    inferredDialogueStructure: dialogueStructure,
    inferredSpeakerCount: speakerCount,
    ...sceneAnalysis,
    castingHints: Object.keys(castingHints).length ? castingHints : undefined,
    recommendedVideoProvider: "runway",
    fallbackPlan: "mock_video",
    confidence: 0.65,
    supervisedBy: "rule_based",
    notes: ["Rule-based analysis — Ollama not available or timed out"],
    generatedAt: new Date().toISOString(),
    ...controls,
  };
}

const SUPERVISOR_SYSTEM = `You are GioHomeStudio's content orchestrator. Analyze the user's video prompt and return ONLY a valid JSON object with these exact fields (no explanation, no markdown, just JSON):
{
  "contentIntent": "one sentence describing what this video is about",
  "inferredSubjectType": "human|animal|product|scene_only",
  "inferredVideoType": "cinematic|realistic|social_short|storytelling|ad_promo",
  "inferredVisualStyle": "photorealistic|cinematic_dark|stylized|bright_commercial|anime",
  "inferredAspectRatio": "9:16|16:9|1:1",
  "inferredMusicMood": "epic|war|rain|heavy_rain|nature|calm|emotional|action|suspense|dance|upbeat|dramatic",
  "inferredMusicGenre": "orchestral|ambient|electronic|acoustic|hip_hop|null",
  "inferredNarrationNeed": true,
  "inferredMusicNeed": true,
  "castingHints": { "ethnicity": "african|arab|asian|white|mixed|null", "culture": "african|arab|asian|latin|western|global|null" },
  "recommendedVideoProvider": "runway|kling",
  "confidence": 0.85,
  "notes": ["key observation about this content"]
}

Rules:
- inferredMusicMood must match the EMOTIONAL TONE of the scene (e.g. war scene → "war", rain scene → "rain", happy dance → "dance")
- if castingHints not determinable, set both fields to null
- inferredAspectRatio: use "16:9" for landscape/YouTube, "9:16" for vertical/reels/TikTok, default "9:16"`;

export interface SupervisorInput {
  rawPrompt: string;
  // User-provided overrides (if set, supervisor should respect them)
  overrides?: {
    videoType?: string;
    visualStyle?: string;
    aspectRatio?: string;
    musicMood?: string;
    musicGenre?: string;
    castingEthnicity?: string;
    cultureContext?: string;
    audioMode?: string;
  };
}

// runSupervisor — two modes:
//   blocking=false (default): returns rule_based instantly, Ollama enriches in background
//   blocking=true: waits for Ollama (used by API route for explicit user preview)
export async function runSupervisor(
  input: SupervisorInput,
  opts: { blocking?: boolean } = {}
): Promise<OrchestrationPlan> {
  // Always start with rule_based for immediate use
  const plan = applyOverrides(ruleBasedPlan(input.rawPrompt), input.overrides);

  if (opts.blocking) {
    // Blocking mode: try LLM synchronously (for "Preview Plan" button)
    try {
      const llmResult = await callLLM(
        `User prompt: "${input.rawPrompt}"`,
        SUPERVISOR_SYSTEM,
        { role: "supervisor", maxTokens: 400, temperature: 0.1, timeoutMs: 40000 }
      );
      if (!llmResult.ok) throw new Error(llmResult.error);
      const raw = llmResult.text;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in Ollama response");
      const parsed = JSON.parse(jsonMatch[0]);
      // SFX + dialogue + scene analysis — not in Ollama response, use rule_based detection
      const soundEvents = detectSoundEventsFromText(input.rawPrompt);
      const { structure: dialogueStructure, speakerCount } = detectDialogueStructure(input.rawPrompt);
      const sceneAnalysis = analyzeScene(input.rawPrompt, speakerCount, soundEvents.length > 0);

      const enriched: OrchestrationPlan = {
        contentIntent: parsed.contentIntent ?? plan.contentIntent,
        inferredSubjectType: parsed.inferredSubjectType ?? plan.inferredSubjectType,
        inferredVideoType: parsed.inferredVideoType ?? plan.inferredVideoType,
        inferredVisualStyle: parsed.inferredVisualStyle ?? plan.inferredVisualStyle,
        inferredAspectRatio: parsed.inferredAspectRatio ?? plan.inferredAspectRatio,
        inferredMusicMood: parsed.inferredMusicMood ?? plan.inferredMusicMood,
        inferredMusicGenre: parsed.inferredMusicGenre === "null" ? undefined : parsed.inferredMusicGenre,
        inferredNarrationNeed: parsed.inferredNarrationNeed ?? plan.inferredNarrationNeed,
        inferredMusicNeed: parsed.inferredMusicNeed ?? plan.inferredMusicNeed,
        inferredSFXNeed: soundEvents.length > 0,
        inferredSoundEvents: soundEvents,
        inferredDialogueStructure: dialogueStructure,
        inferredSpeakerCount: speakerCount,
        ...sceneAnalysis,
        castingHints: parsed.castingHints?.ethnicity && parsed.castingHints.ethnicity !== "null"
          ? { ethnicity: parsed.castingHints.ethnicity, culture: parsed.castingHints.culture !== "null" ? parsed.castingHints.culture : undefined }
          : plan.castingHints,
        recommendedVideoProvider: parsed.recommendedVideoProvider ?? plan.recommendedVideoProvider,
        fallbackPlan: "mock_video",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : plan.confidence,
        supervisedBy: "ollama" as const,
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        generatedAt: new Date().toISOString(),
      };
      return applyOverrides(enriched, input.overrides);
    } catch {
      // Ollama not available — return rule_based (already computed)
    }
  }

  return plan;
}

// ── Story continuation suggestions ───────────────────────────────────────────
// Called after a scene is generated. Analyses the completed item and returns
// a set of smart options the user can click to continue the story.

export interface ContinuationSuggestion {
  id: string;
  label: string;           // short button label shown in UI
  description: string;     // one-line explanation of what this option does
  storyContext: string;    // pre-built context brief to inject into next generation
  promptSeed: string;      // starter prompt text pre-filled in Studio input
  keepCasting: boolean;    // true = carry same ethnicity/gender/age to next scene
  keepVoice: boolean;      // true = keep same voice ID
}

export function generateContinuationSuggestions(
  originalInput: string,
  narrationScript: string | null | undefined,
  plan: OrchestrationPlan | null | undefined,
  castingEthnicity?: string | null,
  castingGender?: string | null,
): ContinuationSuggestion[] {
  // Extract a short scene summary from the narration or original input
  const sceneText = (narrationScript ?? originalInput).slice(0, 120).trim();
  const sceneSummary = sceneText.endsWith(".") ? sceneText : sceneText + "…";

  // Detect likely character name from input (first capitalised name token)
  const nameMatch = originalInput.match(/\b([A-Z][a-z]{2,})\b/);
  const charName = nameMatch ? nameMatch[1] : "the character";
  const ethnicity = plan?.castingHints?.ethnicity ?? castingEthnicity ?? null;
  const gender = castingGender ?? null;

  const baseContext = `Scene summary: ${sceneSummary}`;

  const suggestions: ContinuationSuggestion[] = [
    {
      id: "same_char_same_voice",
      label: `Continue with ${charName} — same character & voice`,
      description: `${charName} stays the same person. Story picks up right where it ended.`,
      storyContext: `${baseContext} Continue with ${charName} as the main character. Keep the same voice, appearance, and energy.`,
      promptSeed: `Continue the story — ${charName} now`,
      keepCasting: true,
      keepVoice: true,
    },
    {
      id: "same_char_new_scene",
      label: `${charName} — new scene, same story`,
      description: `Jump to a new location or moment. Same character, different setting.`,
      storyContext: `${baseContext} Same character: ${charName}. New scene — different location or time, but the same story continues.`,
      promptSeed: `${charName} arrives at`,
      keepCasting: true,
      keepVoice: true,
    },
    {
      id: "new_character_meets",
      label: `Introduce a new character who meets ${charName}`,
      description: `A second character enters the scene and interacts with ${charName}.`,
      storyContext: `${baseContext} A new character enters and meets ${charName}. Use a different voice for the new character.`,
      promptSeed: `A stranger approaches ${charName} and says`,
      keepCasting: true,
      keepVoice: false,
    },
    {
      id: "enemy_antagonist",
      label: `Introduce the antagonist / enemy`,
      description: `The opposing force appears. Tension rises.`,
      storyContext: `${baseContext} The antagonist appears. Conflict begins. Set a tense, dramatic tone — different voice from ${charName}.`,
      promptSeed: `The enemy appears — confronting ${charName}`,
      keepCasting: false,
      keepVoice: false,
    },
    {
      id: "time_jump_forward",
      label: `Jump forward in time — ${charName} is older / later`,
      description: `Flash forward. What happened after? Show the consequence.`,
      storyContext: `${baseContext} Time has passed. ${charName} is now in a different situation — older, wiser, or in a new chapter of life.`,
      promptSeed: `Years later, ${charName}`,
      keepCasting: true,
      keepVoice: true,
    },
    {
      id: "flashback",
      label: `Flashback — show what happened before this scene`,
      description: `Go back in time. Reveal the origin or backstory.`,
      storyContext: `${baseContext} This is a flashback — going back in time to reveal what led to this moment.`,
      promptSeed: `Before all this — ${charName} was`,
      keepCasting: true,
      keepVoice: true,
    },
    {
      id: "different_perspective",
      label: `Tell the same story from another character's view`,
      description: `Same events, different narrator or point of view.`,
      storyContext: `${baseContext} Retell from a different character's perspective. Same events, different emotional angle.`,
      promptSeed: `From another perspective — someone watching ${charName}`,
      keepCasting: false,
      keepVoice: false,
    },
    {
      id: "emotional_climax",
      label: `Build to the emotional climax`,
      description: `Peak emotional moment — resolution, loss, triumph, or heartbreak.`,
      storyContext: `${baseContext} This is the emotional peak of the story. Maximum tension, drama, or feeling.`,
      promptSeed: `The most intense moment — ${charName}`,
      keepCasting: true,
      keepVoice: true,
    },
  ];

  // If no clear character name detected, simplify the labels
  if (!nameMatch) {
    return suggestions.map(s => ({
      ...s,
      label: s.label.replace(new RegExp(charName, "g"), "the character"),
      promptSeed: s.promptSeed.replace(new RegExp(charName, "g"), ""),
    }));
  }

  return suggestions;
}

function applyOverrides(plan: OrchestrationPlan, overrides?: SupervisorInput["overrides"]): OrchestrationPlan {
  if (!overrides) return plan;
  if (overrides.videoType)        plan.inferredVideoType    = overrides.videoType;
  if (overrides.visualStyle)      plan.inferredVisualStyle  = overrides.visualStyle;
  if (overrides.aspectRatio)      plan.inferredAspectRatio  = overrides.aspectRatio;
  if (overrides.musicMood)        plan.inferredMusicMood    = overrides.musicMood;
  if (overrides.musicGenre)       plan.inferredMusicGenre   = overrides.musicGenre;
  if (overrides.audioMode === "voice_only")  plan.inferredMusicNeed      = false;
  if (overrides.audioMode === "music_only")  plan.inferredNarrationNeed  = false;
  if (overrides.castingEthnicity) plan.castingHints = { ...plan.castingHints, ethnicity: overrides.castingEthnicity };
  if (overrides.cultureContext)   plan.castingHints = { ...plan.castingHints, culture:   overrides.cultureContext };
  return plan;
}
