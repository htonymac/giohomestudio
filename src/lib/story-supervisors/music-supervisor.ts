// Music Supervisor — creates a music map and validates music choices

import type {
  SupervisorResult,
  ScenePlan,
  StoryContract,
  MusicMap,
  StoryType,
} from "./types";

// ── Music selection by emotion ────────────────────────────────────────────────

const EMOTION_TO_MUSIC: Record<string, string> = {
  // Calm / intro
  calm: "soft ambient background with gentle strings",
  ordinary_world: "soft ambient background with gentle piano",
  everyday: "light peaceful ambient, acoustic guitar",
  introduction: "warm welcoming ambient instrumental",
  ancient_calm: "traditional cultural ambient, soft drums",
  wonder: "magical whimsical background, gentle bells and flute",

  // Curiosity / exploration
  curiosity: "light curious ambient with subtle pizzicato strings",
  exploration: "adventurous light instrumental, moderate tempo",
  discovery: "building ambient with sense of wonder",
  curiosity_active: "rhythmic curious instrumental",

  // Sadness / concern
  concern: "low gentle piano with soft ambience",
  sadness: "low sad piano with soft ambience",
  grief: "solo cello or violin, melancholic, slow",
  regret: "quiet somber piano, distant and lonely",
  doubt: "quiet uncertain piano, sparse notes",
  reflection: "soft introspective piano with gentle ambient",

  // Tension / suspense
  tension: "tense percussion building, low strings",
  suspense: "dark minimal suspense, distant heartbeat rhythm",
  ominous: "dark drone with distant percussion",
  threat: "low tension build, brass undertones",
  conflict: "tense confrontational strings and percussion",
  ordeal: "intense dramatic orchestral, low and driving",
  complication: "dissonant strings, tense",
  challenge: "moderate tension, building underscore",
  trial: "somber determined underscore, low strings",

  // Action / energy
  action: "tense percussion building into full action drive",
  action_heavy: "high energy percussion, driving beat, powerful",
  escalation: "building action tempo, energetic",
  confrontation: "dramatic orchestral confrontation",
  tests: "action-ready moderate energy, drums forward",

  // Victory / joy
  victory: "uplifting celebration music, brass triumph",
  joy: "uplifting celebration music, light and warm",
  triumph: "triumphant fanfare, full orchestral",
  happiness: "cheerful bright instrumental, warm and sunny",
  friendship: "warm heartfelt acoustic with gentle melody",
  legacy: "soaring orchestral, generational feel",

  // Hope / relief
  hope: "hopeful melody rising, strings and light piano",
  relief: "soft resolution piano, tension releasing",
  resolution: "calm resolution strings, gentle closure",
  new_normal: "peaceful hopeful ambient, looking forward",
  return: "homecoming warmth, familiar theme restated",

  // Faith / spiritual
  prayer: "reverent ambient, soft choir or organ",
  faith: "steady gospel undertone, hopeful",
  miracle: "awe-inspiring orchestral swell, choir",
  gratitude: "gospel-inspired warm swell, thankful",
  testimony: "inspirational gospel feel, building",
  intervention: "otherworldly ambient, mysterious and sacred",

  // Children
  playful: "playful bouncy melody, xylophone and light percussion",
  gentle_challenge: "slightly tense but safe children's music",
  adventure: "children's adventure theme, bouncy and fun",
  learning: "curious educational theme, light and encouraging",
  application: "confident bright children's theme",
  understanding: "gentle 'aha moment' music, warm resolution",
  practice: "encouraging upbeat children's background",

  // Inspirational
  inspirational: "uplifting orchestral rise, strings forward",
  call_to_adventure: "heroic adventure theme, building",
  call_to_action: "energetic motivational build",
  redemption: "rising redemptive orchestral, strings and choir",
  resurrection: "powerful triumphant return, full orchestral",

  // Commercial / hook
  hook: "attention-grabbing modern beat, punchy",
  problem: "slightly tense modern track, problem feeling",
  solution: "uplifting reveal sting, positive",
  desire: "aspirational ambient with emotional string rise",

  // Comedy / skit
  setup: "casual comedic background, light",
  punchline: "comedic sting or exaggerated musical moment",
  reaction: "playful comedic reaction music",

  // Moral / lesson
  lesson: "warm reflective piano, lesson sinking in",
  consequence: "somber piano, facing the music",
  temptation: "slightly sinister playful theme",
  wrong_choice: "subtle dissonant theme",

  // Documentary
  insight: "thoughtful documentary ambient, gentle",
  revelation: "documentary swell, important moment",
  conclusion: "documentary wrap-up, gentle resolution",

  // Folklore
  trials: "traditional cultural underscore, mid energy",
  wisdom: "elder storytelling tone, traditional instruments",

  // Neutral / fallback
  neutral: "subtle ambient background, unobtrusive",
  normal: "light neutral ambient background",
  turn: "pivotal moment swell, cinematic",
  allies: "warm ensemble moment, supportive",
  enemies: "ominous minimal underscore",
  approach: "building approach music, moderate tension",
  reward: "bright moment of achievement, warm swell",
  road_back: "reflective journey music, looking back",
  buildup: "slow build ambient, anticipation",
  climax: "full orchestral climax, all instruments",
};

function getMusicForEmotion(emotion: string, storyType: StoryType): string {
  const emotionKey = emotion.toLowerCase().replace(/\s+/g, "_");

  // Children story override — always gentle
  if (storyType === "children_story") {
    const childrenSafe = EMOTION_TO_MUSIC[emotionKey];
    if (childrenSafe) return childrenSafe;
    return "playful bouncy melody, xylophone and light percussion";
  }

  // Faith story — prefer gospel undertones
  if (storyType === "faith_story") {
    if (emotionKey.includes("triumph") || emotionKey.includes("joy") || emotionKey.includes("victory")) {
      return "uplifting gospel choir with full orchestral backing";
    }
    if (emotionKey.includes("sad") || emotionKey.includes("grief") || emotionKey.includes("trial")) {
      return "slow gospel piano, sorrowful but hopeful";
    }
  }

  return EMOTION_TO_MUSIC[emotionKey] ?? EMOTION_TO_MUSIC["neutral"] ?? "ambient background music";
}

// ── SFX recommendations by scene context ─────────────────────────────────────

function recommendSFX(scene: ScenePlan): string[] {
  const sfx: string[] = [...(scene.sfx_cues ?? [])];
  const locationLower = (scene.location ?? "").toLowerCase();
  const emotionLower = (scene.emotion ?? "").toLowerCase();
  const visualLower = (scene.visual_prompt ?? "").toLowerCase();

  // Location-based SFX
  if (locationLower.includes("market") || visualLower.includes("market")) {
    if (!sfx.includes("market_ambience")) sfx.push("market_ambience");
  }
  if (locationLower.includes("forest") || visualLower.includes("forest")) {
    if (!sfx.includes("birds_chirping")) sfx.push("birds_chirping");
  }
  if (locationLower.includes("rain") || visualLower.includes("rain")) {
    if (!sfx.includes("rain_falling")) sfx.push("rain_falling");
  }
  if (locationLower.includes("church") || visualLower.includes("church")) {
    if (!sfx.includes("church_ambience")) sfx.push("church_ambience");
  }
  if (locationLower.includes("school") || visualLower.includes("classroom")) {
    if (!sfx.includes("children_ambient")) sfx.push("children_ambient");
  }
  if (locationLower.includes("street") || locationLower.includes("road")) {
    if (!sfx.includes("street_traffic")) sfx.push("street_traffic");
  }

  // Emotion-based SFX
  if (emotionLower.includes("tension") || emotionLower.includes("suspense")) {
    if (!sfx.includes("heartbeat")) sfx.push("heartbeat");
  }
  if (emotionLower.includes("joy") || emotionLower.includes("victory")) {
    if (!sfx.includes("crowd_cheer")) sfx.push("crowd_cheer");
  }
  if (emotionLower.includes("sadness") || emotionLower.includes("grief")) {
    if (!sfx.includes("soft_crying")) sfx.push("soft_crying");
  }
  if (emotionLower.includes("prayer") || emotionLower.includes("faith")) {
    if (!sfx.includes("gentle_church_organ")) sfx.push("gentle_church_organ");
  }

  return sfx;
}

// ── Consecutive music repeat checker ─────────────────────────────────────────

function checkConsecutiveRepeats(updatedScenes: ScenePlan[]): string[] {
  const warnings: string[] = [];
  let repeatStart = 0;
  let repeatCount = 1;

  for (let i = 1; i < updatedScenes.length; i++) {
    if (updatedScenes[i].music_cue === updatedScenes[i - 1].music_cue) {
      repeatCount++;
      if (repeatCount > 3) {
        if (repeatCount === 4) {
          warnings.push(
            `Scenes "${updatedScenes[repeatStart].scene_id}" through ` +
              `"${updatedScenes[i].scene_id}" use the same music_cue 4+ times in a row: ` +
              `"${updatedScenes[i].music_cue}". Music should vary to avoid monotony.`
          );
        }
      }
    } else {
      repeatCount = 1;
      repeatStart = i;
    }
  }

  return warnings;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runMusicSupervisor(
  scenes: ScenePlan[],
  contract: StoryContract
): SupervisorResult<{ musicMap: MusicMap; updatedScenes: ScenePlan[] }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  if (scenes.length === 0) {
    return {
      passed: false,
      score: 0,
      blockingIssues: ["No scenes provided to music supervisor."],
      warnings: [],
      suggestedFixes: ["Run scene demarcation before music supervision."],
      revisedData: { musicMap: {}, updatedScenes: [] },
    };
  }

  const musicMap: MusicMap = {};

  // Build updated scenes with music assignments
  const updatedScenes: ScenePlan[] = scenes.map((scene) => {
    const assignedMusic = scene.music_cue && scene.music_cue !== "ambient background music"
      ? scene.music_cue
      : getMusicForEmotion(scene.emotion ?? "neutral", contract.storyType);

    const updatedSFX = recommendSFX({ ...scene });

    const mapEntry: MusicMap[string] = {
      music: assignedMusic,
      sfx: updatedSFX,
    };
    musicMap[scene.scene_id] = mapEntry;

    return {
      ...scene,
      music_cue: assignedMusic,
      sfx_cues: updatedSFX,
    };
  });

  // Check consecutive repeats
  const repeatWarnings = checkConsecutiveRepeats(updatedScenes);
  warnings.push(...repeatWarnings);

  if (repeatWarnings.length > 0) {
    suggestedFixes.push(
      "Introduce music variation: use transitional music or a contrasting mood cue " +
        "between repeated music segments."
    );
  }

  // Validate first and last scene music
  const firstScene = updatedScenes[0];
  const lastScene = updatedScenes[updatedScenes.length - 1];

  const calmOpenings = ["soft ambient", "warm welcoming", "light peaceful", "magical whimsical"];
  const firstIsCalmEnough = calmOpenings.some((c) => firstScene.music_cue.toLowerCase().includes(c));
  if (!firstIsCalmEnough && contract.storyType !== "ad_commercial" && contract.storyType !== "skit") {
    warnings.push(
      `First scene music_cue "${firstScene.music_cue}" may be too intense for an opening. ` +
        `Consider starting with softer ambient music.`
    );
    suggestedFixes.push(
      `Change first scene music to "soft ambient background with gentle piano" or similar.`
    );
  }

  const resolutionEndings = ["resolution", "peaceful", "warm", "hopeful", "closure", "triumph", "gospel"];
  const lastIsResolved = resolutionEndings.some((r) => lastScene.music_cue.toLowerCase().includes(r));
  if (!lastIsResolved && contract.storyType !== "skit") {
    warnings.push(
      `Last scene music_cue "${lastScene.music_cue}" may not provide proper emotional closure.`
    );
    suggestedFixes.push(
      `Consider ending with resolving music: "calm resolution strings, gentle closure" or "warm homecoming theme".`
    );
  }

  const score = blockingIssues.length > 0
    ? 0
    : warnings.length > 3
    ? 70
    : warnings.length > 0
    ? 85
    : 100;

  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { musicMap, updatedScenes },
    metadata: {
      totalScenes: scenes.length,
      uniqueMusicCues: new Set(Object.values(musicMap).map((m) => m.music)).size,
      storyType: contract.storyType,
    },
  };
}
