// Core types for GHS Story Quality Control Layer

export type SupervisorResult<T = unknown> = {
  passed: boolean;
  score: number;
  blockingIssues: string[];
  warnings: string[];
  suggestedFixes: string[];
  revisedData?: T;
  metadata?: Record<string, unknown>;
};

export type StoryType =
  | "short_story" | "long_story" | "children_story" | "movie"
  | "ad_commercial" | "skit" | "moral_lesson" | "folklore"
  | "documentary" | "faith_story" | "educational";

export type EmotionalIntensity =
  | "normal" | "more_emotional" | "very_emotional" | "cinematic"
  | "funny" | "dark" | "inspirational" | "suspense" | "action_heavy";

export type LanguageLevel =
  | "normal_english" | "simple_english" | "nigerian_english"
  | "childrens_english" | "voiceover_friendly" | "subtitle_friendly";

export type SubtitleStyle =
  | "normal_movie" | "children_story" | "karaoke" | "action"
  | "emotional" | "educational";

export type GenerationMode =
  | "full_video" | "hybrid" | "image_storybook" | "voiceover_story" | "children_song";

export interface StoryContract {
  storyId: string;
  country: string;
  culture: string;
  storyType: StoryType;
  totalDurationSeconds: number;
  sceneDurationSeconds: number;
  estimatedSceneCount: number;
  languageLevel: LanguageLevel;
  emotionalIntensity: EmotionalIntensity;
  subtitleStyle: SubtitleStyle;
  generationMode: GenerationMode;
  targetAudience: string;
  ageRating: string;
  defaultCastAssumptions: {
    ethnicity: string;
    countryContext: string;
    allowWhiteCastOnlyIfUserRequests: boolean;
  };
  musicStyle?: string;
  nameStyle?: string;
}

export interface CastBibleEntry {
  character_id: string;
  name: string;
  age: string;
  gender: string;
  ethnicity: string;
  skin_tone: string;
  body_type: string;
  hair: string;
  clothing: string;
  role: string;
  personality: string;
  voice_style: string;
  relationship: string;
  emotional_arc?: string;
  first_scene?: string;
  scenes?: string[];
  costume_changes?: Array<{ scene: string; change: string }>;
}

// Shot = generation unit inside a Scene (Scene is a Folder of Shots)
export interface ShotPlan {
  shot_id: string;              // SH{scene_number}-{shot_index} e.g. SH04-01
  scene_id: string;
  characters_visible: string[]; // CH01, CH02 etc
  speaking_character_id: string;
  listening_character_ids: string[];
  camera_angle: string;
  camera_movement: string;
  framing_type: "closeup" | "medium" | "wide" | "macro" | "topdown" | "over_shoulder";
  lighting_style: string;
  dialogue_line: string;        // owned by speaking_character_id
  audio_timing: number;         // seconds offset from scene start
  sfx_cues: string[];
  duration: number;             // seconds
  motion_preset?: string;
  image_prompt?: string;
  video_prompt?: string;
  negative_prompt?: string;
  provider_recommendation?: "image_plus_motion" | "video" | "image_voiceover" | "hybrid";
}

export interface ScenePlan {
  scene_id: string;
  scene_number: number;
  duration: number;
  title: string;
  summary: string;
  characters: string[];
  location: string;
  time_of_day: string;
  emotion: string;
  visual_prompt: string;
  image_prompt: string;
  video_prompt: string;
  negative_prompt: string;
  voiceover_text: string;
  dialogue: string;
  subtitle_text: string;
  subtitle_style: string;
  music_cue: string;
  sfx_cues: string[];
  camera_style: string;
  continuity_notes: string[];
  provider_recommendation: "image_plus_motion" | "video" | "image_voiceover" | "hybrid";
  provider_reason: string;
  shots?: ShotPlan[]; // shot-level breakdown (Scene is a Folder of Shots)
}

export interface StoryQCInput {
  storyText: string;
  contract: StoryContract;
  castBible?: CastBibleEntry[];
  scenes?: ScenePlan[];
}

export interface EmotionCurve {
  [sceneId: string]: string;
}

export interface MusicMap {
  [sceneId: string]: {
    music: string;
    sfx: string[];
  };
}

export interface ContinuityLedger {
  [sceneId: string]: {
    important_changes: string[];
    next_scene_requirements?: string[];
  };
}
