// Emotion Intensifier — builds emotion curve and enhances scene prompts

import type {
  SupervisorResult,
  ScenePlan,
  StoryContract,
  EmotionCurve,
  StoryType,
  EmotionalIntensity,
} from "./types";

// ── Emotion arc templates by story type ──────────────────────────────────────

type EmotionArc = string[];

const EMOTION_ARCS: Record<StoryType, (sceneCount: number) => EmotionArc> = {
  short_story: (n) => buildArc(n, ["calm", "concern", "tension", "climax", "relief", "resolution"]),
  long_story: (n) => buildArc(n, ["calm", "curiosity", "buildup", "complication", "tension", "conflict", "climax", "turn", "relief", "resolution"]),
  children_story: (n) => buildArc(n, ["wonder", "curiosity", "adventure", "gentle_challenge", "friendship", "joy", "learning", "happiness"]),
  movie: (n) => buildMovieArc(n),
  ad_commercial: (n) => buildArc(n, ["hook", "problem", "solution", "desire", "call_to_action"]),
  skit: (n) => buildArc(n, ["setup", "complication", "escalation", "punchline", "reaction"]),
  moral_lesson: (n) => buildArc(n, ["normal", "temptation", "wrong_choice", "consequence", "reflection", "redemption", "lesson"]),
  folklore: (n) => buildArc(n, ["ancient_calm", "call_to_adventure", "trials", "wisdom", "confrontation", "victory", "legacy"]),
  documentary: (n) => buildArc(n, ["introduction", "exploration", "discovery", "challenge", "insight", "revelation", "conclusion"]),
  faith_story: (n) => buildArc(n, ["everyday", "doubt", "trial", "prayer", "intervention", "faith", "miracle", "gratitude", "testimony"]),
  educational: (n) => buildArc(n, ["introduction", "curiosity", "example", "explanation", "practice", "demonstration", "understanding", "application"]),
};

function buildArc(count: number, template: EmotionArc): EmotionArc {
  if (count <= 0) return [];
  if (count === 1) return [template[Math.floor(template.length / 2)]];

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const templateIdx = Math.round((i / (count - 1)) * (template.length - 1));
    result.push(template[Math.min(templateIdx, template.length - 1)]);
  }
  return result;
}

function buildMovieArc(n: number): EmotionArc {
  // 3-act structure with midpoint
  const act1End = Math.floor(n * 0.25);
  const midpoint = Math.floor(n * 0.5);
  const act2End = Math.floor(n * 0.75);

  const arc: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < act1End) {
      const emotions = ["ordinary_world", "call_to_adventure", "refusal", "acceptance"];
      arc.push(emotions[Math.floor((i / act1End) * emotions.length)] ?? "calm");
    } else if (i < midpoint) {
      const emotions = ["tests", "allies", "enemies", "approach"];
      const idx = i - act1End;
      arc.push(emotions[Math.floor((idx / (midpoint - act1End)) * emotions.length)] ?? "tension");
    } else if (i < act2End) {
      const emotions = ["ordeal", "reward", "road_back", "resurrection"];
      const idx = i - midpoint;
      arc.push(emotions[Math.floor((idx / (act2End - midpoint)) * emotions.length)] ?? "climax");
    } else {
      const emotions = ["return", "movie_resolution", "new_normal"];
      const idx = i - act2End;
      arc.push(emotions[Math.floor((idx / (n - act2End)) * emotions.length)] ?? "resolution");
    }
  }
  return arc;
}

// ── Emotional intensity modifiers ────────────────────────────────────────────

interface EmotionDescriptors {
  prefix: string;
  cameraStyle: string;
  lightingNote: string;
  colorGrade: string;
}

const INTENSITY_MODIFIERS: Record<EmotionalIntensity, EmotionDescriptors> = {
  normal: {
    prefix: "",
    cameraStyle: "medium shot",
    lightingNote: "natural lighting",
    colorGrade: "warm natural tones",
  },
  more_emotional: {
    prefix: "emotionally charged, ",
    cameraStyle: "medium close-up",
    lightingNote: "soft warm lighting",
    colorGrade: "slightly warm desaturated tones",
  },
  very_emotional: {
    prefix: "deeply emotional, heart-wrenching, ",
    cameraStyle: "close-up with shallow depth of field",
    lightingNote: "dramatic soft window light",
    colorGrade: "desaturated with warm highlights",
  },
  cinematic: {
    prefix: "cinematic, film-quality, ",
    cameraStyle: "wide cinematic shot",
    lightingNote: "dramatic golden hour or controlled studio lighting",
    colorGrade: "cinematic color grade, teal and orange",
  },
  funny: {
    prefix: "playful, comedic, lighthearted, ",
    cameraStyle: "medium wide shot",
    lightingNote: "bright even lighting",
    colorGrade: "bright saturated colors",
  },
  dark: {
    prefix: "dark, brooding, somber, ",
    cameraStyle: "low angle or dutch angle",
    lightingNote: "low-key dramatic lighting with deep shadows",
    colorGrade: "dark desaturated, cool blue-grey tones",
  },
  inspirational: {
    prefix: "uplifting, hopeful, inspiring, ",
    cameraStyle: "upward angle or wide shot",
    lightingNote: "warm golden light",
    colorGrade: "warm golden tones",
  },
  suspense: {
    prefix: "tense, suspenseful, ominous, ",
    cameraStyle: "tight close-up or slow push-in",
    lightingNote: "harsh shadows, limited lighting",
    colorGrade: "cool desaturated with sharp contrast",
  },
  action_heavy: {
    prefix: "high energy, dynamic, explosive, ",
    cameraStyle: "dynamic low angle or tracking shot",
    lightingNote: "harsh directional lighting",
    colorGrade: "punchy high contrast",
  },
};

// Per-emotion visual enhancement words
const EMOTION_VISUAL_BOOSTERS: Record<string, string> = {
  calm: "serene, peaceful atmosphere, soft natural light",
  concern: "worried expression, furrowed brow, uncertain posture",
  tension: "tense body language, gripping hands, anxious expression",
  climax: "intense dramatic moment, peak emotion, gripping",
  relief: "relieved expression, shoulders relaxed, peaceful exhale",
  resolution: "calm resolution, hopeful look, gentle smile",
  curiosity: "curious expression, leaning forward, wide eyes",
  buildup: "building energy, anticipation visible",
  complication: "troubled expression, conflicted body language",
  conflict: "confrontational stance, high tension between characters",
  turn: "turning point moment, shocked or determined expression",
  wonder: "wide-eyed wonder, magical atmosphere, childlike amazement",
  adventure: "excited expression, dynamic pose, sense of movement",
  gentle_challenge: "gentle worry, supportive expressions",
  friendship: "warm smiles, close proximity, togetherness",
  joy: "genuine laughter, open arms, radiant smiles",
  learning: "thoughtful expression, nodding, understanding dawning",
  happiness: "beaming joy, warm golden light, celebration",
  hook: "attention-grabbing moment, striking visual",
  problem: "problem clearly visible, relatable concern",
  solution: "revealing moment, 'aha' expression",
  desire: "longing expression, aspirational framing",
  call_to_action: "direct confident gaze, energetic pose",
  setup: "everyday casual scene, relaxed atmosphere",
  skit_complication: "something going wrong, comedic confusion",
  escalation: "things getting worse comedically, exaggerated reaction",
  punchline: "comedic payoff moment, surprised or caught expression",
  reaction: "genuine surprised reaction, comedic double-take",
  normal: "everyday ordinary moment, relaxed",
  temptation: "tempting object or situation prominent, hesitation",
  wrong_choice: "making a mistake, in the moment of poor decision",
  consequence: "facing consequences, regretful expression",
  reflection: "looking down or away thoughtfully, quiet moment",
  redemption: "rising again, determined eyes, turning back",
  lesson: "wisdom visible in expression, peaceful understanding",
  ancient_calm: "timeless atmosphere, ancient setting, peaceful",
  call_to_adventure: "the hero's journey beginning, looking toward horizon",
  trials: "overcoming obstacles, determined face",
  wisdom: "elder or wise character, knowledge being shared",
  confrontation: "face-to-face dramatic moment",
  victory: "triumphant expression, arms raised or fists clenched in win",
  legacy: "looking into the future, generational pass-down",
  introduction: "welcoming opening, establishing shot",
  exploration: "active exploration, curiosity in action",
  discovery: "moment of finding or realizing something",
  challenge: "obstacle present, facing difficulty",
  insight: "moment of understanding, thoughtful expression",
  revelation: "dramatic reveal, wide eyes",
  conclusion: "summary wrap-up, peaceful ending",
  everyday: "ordinary life, relatable daily scene",
  doubt: "questioning expression, uncertain look upward",
  trial: "difficult moment of testing",
  prayer: "hands folded, eyes closed, spiritual atmosphere",
  intervention: "supernatural or providential moment",
  faith: "firm determined faith-filled expression",
  miracle: "awe and wonder, hands to face in amazement",
  gratitude: "grateful expression, looking upward with peace",
  testimony: "speaking from the heart, emotional truth",
  example: "concrete demonstration, clear illustration",
  explanation: "explaining gesture, pointing or demonstrating",
  practice: "actively doing, hands-on activity",
  demonstration: "showing clearly, confident demonstration",
  understanding: "comprehension dawning, nodding gently",
  application: "using new knowledge, confident action",
  ordinary_world: "ordinary daily life, familiar comfortable setting",
  refusal: "shaking head, resistant posture",
  acceptance: "nodding, determined stepping forward",
  tests: "facing a test or challenge, tense readiness",
  allies: "supportive characters around, warmth and camaraderie",
  enemies: "antagonist present, opposition visible",
  approach: "moving toward the goal, focused expression",
  ordeal: "the darkest moment, peak struggle",
  reward: "achieving something, earned moment",
  road_back: "journey back, reflective movement",
  resurrection: "rising from defeat, triumphant return",
  return: "homecoming, relief of return",
  movie_resolution: "all issues resolved, peace",
  new_normal: "life after the story, changed world",
};

function getEmotionBooster(emotion: string): string {
  return EMOTION_VISUAL_BOOSTERS[emotion] ?? `${emotion} emotional tone, expressive facial performance`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runEmotionIntensifier(
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult<{ emotionCurve: EmotionCurve; enhancedScenes: ScenePlan[] }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  if (scenes.length === 0) {
    return {
      passed: false,
      score: 0,
      blockingIssues: ["No scenes provided to emotion intensifier."],
      warnings: [],
      suggestedFixes: ["Run scene demarcation before emotion intensification."],
      revisedData: { emotionCurve: {}, enhancedScenes: [] },
    };
  }

  // Build emotion arc
  const arcBuilder = EMOTION_ARCS[contract.storyType];
  const emotionArc = arcBuilder(scenes.length);
  const emotionCurve: EmotionCurve = {};

  for (let i = 0; i < scenes.length; i++) {
    const sceneId = scenes[i].scene_id;
    emotionCurve[sceneId] = emotionArc[i] ?? "neutral";
  }

  const intensityMod = INTENSITY_MODIFIERS[contract.emotionalIntensity];

  // Enhance each scene
  const enhancedScenes: ScenePlan[] = scenes.map((scene, idx) => {
    const assignedEmotion = emotionArc[idx] ?? scene.emotion ?? "neutral";
    const emotionBooster = getEmotionBooster(assignedEmotion);

    // Enhance visual_prompt
    const enhancedVisual = scene.visual_prompt
      ? `${intensityMod.prefix}${scene.visual_prompt}. ${emotionBooster}. ${intensityMod.lightingNote}, ${intensityMod.colorGrade}.`
      : `${intensityMod.prefix}${emotionBooster}. ${intensityMod.lightingNote}.`;

    // Enhance image_prompt
    const enhancedImage = scene.image_prompt
      ? `${scene.image_prompt} ${emotionBooster}. ${intensityMod.colorGrade}.`
      : `${intensityMod.prefix}${emotionBooster}`;

    // Enhance camera_style if not already set specifically
    const cameraStyle =
      scene.camera_style && scene.camera_style !== "medium shot"
        ? scene.camera_style
        : intensityMod.cameraStyle;

    return {
      ...scene,
      emotion: assignedEmotion,
      visual_prompt: enhancedVisual,
      image_prompt: enhancedImage,
      camera_style: cameraStyle,
    };
  });

  // Validate: children story should have no dark emotions
  if (contract.storyType === "children_story") {
    const darkEmotions = Object.values(emotionCurve).filter((e) =>
      ["dark", "horror", "terror", "death", "violence", "ordeal"].includes(e)
    );
    if (darkEmotions.length > 0) {
      warnings.push(
        `Children's story arc contains ${darkEmotions.length} dark emotion segments. ` +
          `Review the emotion curve for age-appropriateness.`
      );
      suggestedFixes.push(
        `Change story type or emotional intensity — children_story should use gentle, safe emotion arcs.`
      );
    }
  }

  // Check emotional intensity vs story type compatibility
  if (
    contract.storyType === "children_story" &&
    (contract.emotionalIntensity === "dark" ||
      contract.emotionalIntensity === "very_emotional" ||
      contract.emotionalIntensity === "suspense")
  ) {
    warnings.push(
      `Emotional intensity "${contract.emotionalIntensity}" may be too intense for a children's story.`
    );
    suggestedFixes.push(
      `Consider changing emotional intensity to "normal", "funny", or "inspirational" for children_story type.`
    );
  }

  const score = warnings.length > 2 ? 70 : warnings.length > 0 ? 85 : 100;
  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { emotionCurve, enhancedScenes },
    metadata: {
      storyType: contract.storyType,
      emotionalIntensity: contract.emotionalIntensity,
      sceneCount: scenes.length,
      arcTemplate: emotionArc,
    },
  };
}
