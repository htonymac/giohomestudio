// GioHomeStudio — Pipeline Types

import type { SpeechStyle, ElevenLabsModel } from "@/types/providers";

export type JobType =
  | "PROMPT_ENHANCE"
  | "VIDEO_GENERATE"
  | "VOICE_GENERATE"
  | "MUSIC_GENERATE"
  | "FFMPEG_MERGE";

export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export interface PipelineInput {
  rawInput: string;
  mode?: "FREE";
  durationSeconds?: number;
  voiceId?: string;
  voiceLanguage?: string;
  voiceModel?: ElevenLabsModel; // explicit ElevenLabs model; auto-selected if omitted
  requestedVoiceProvider?: "elevenlabs" | "mock_voice";
  narrationSpeed?: number;   // speech rate 0.7-1.2
  narrationVolume?: number;  // voice level in FFmpeg mix 0.0-1.0
  outputMode?: "text_to_video" | "text_to_audio" | "video_to_video" | "images_audio" | "hybrid" | "image_to_video";
  audioMode?: "voice_music" | "voice_only" | "music_only" | "audio_only";
  castingCharacters?: string[];
  speechStyle?: SpeechStyle;   // user override — takes precedence over supervisor-detected style
  musicMood?: string;
  musicProvider?: string;    // per-request music provider override
  musicVolume?: number;      // music ducking level 0.0-1.0
  musicGenre?: string;
  musicRegion?: string;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  contentItemId?: string; // pre-created item from API route — skip createContentItem if set
  destinationPageId?: string;
  videoProvider?: "runway" | "kling" | "mock_video"; // per-request override; falls back to VIDEO_PROVIDER env var
  videoQuality?: "draft" | "standard" | "high";
  videoType?: "cinematic" | "ad_promo" | "realistic" | "animation" | "storytelling" | "social_short";
  visualStyle?: "photorealistic" | "stylized" | "anime" | "3d" | "cinematic_dark" | "bright_commercial";
  subjectType?: "human" | "animal" | "product" | "scene_only" | "custom_character";
  customSubjectDescription?: string;
  aiAutoMode?: boolean;
  castingEthnicity?: string;
  castingGender?: string;
  castingAge?: string;
  castingCount?: string;
  cultureContext?: string;
  referenceImageUrl?: string;
  storyContext?: string;           // continuation brief — supervisor/user summary of what happened before
  previousContentItemId?: string;  // ID of the scene this continues from
  storyThreadId?: string;          // shared thread ID linking all scenes in a story
  sourceVideoPath?: string;        // video_to_video mode: path to uploaded source video
  imageActionPrompt?: string;      // image_to_video mode: what the character should do, e.g. "make her turn and smile"
}

export interface PipelineResult {
  contentItemId: string;
  status: "completed" | "failed" | "review_pending";
  mergedOutputPath?: string;
  error?: string;
  jobResults: {
    promptEnhance?: { success: boolean; enhancedPrompt?: string };
    videoGenerate?: { success: boolean; videoPath?: string };
    voiceGenerate?: { success: boolean; voicePath?: string };
    musicGenerate?: { success: boolean; musicPath?: string };
    ffmpegMerge?: { success: boolean; mergedPath?: string };
  };
}

export interface JobRecord {
  id: string;
  contentItemId: string;
  type: JobType;
  status: JobStatus;
  providerUsed?: string | null;
  providerJobId?: string | null;
  outputPath?: string | null;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
