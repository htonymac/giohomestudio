// GioHomeStudio — Pipeline Types

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
  musicMood?: string;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  contentItemId?: string; // pre-created item from API route — skip createContentItem if set
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
