// GioHomeStudio — Provider Interfaces
// These are the contracts each provider adapter must implement.

// ─────────────────────────────────────────────
// PROMPT ENHANCER
// ─────────────────────────────────────────────

export interface PromptEnhancerInput {
  rawInput: string;
  mode?: "FREE";
  targetDuration?: number; // seconds
  style?: string;
}

export interface PromptEnhancerOutput {
  enhancedPrompt: string;
  suggestions?: string[];
  tokensUsed?: number;
}

export interface IPromptEnhancer {
  enhance(input: PromptEnhancerInput): Promise<PromptEnhancerOutput>;
}

// ─────────────────────────────────────────────
// VIDEO PROVIDER
// ─────────────────────────────────────────────

export interface VideoGenerationInput {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  style?: string;
}

export interface VideoGenerationOutput {
  jobId: string;          // provider-side job ID for polling
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;      // available when status = completed
  localPath?: string;     // set after download
  error?: string;
}

export interface IVideoProvider {
  readonly name: string;
  generate(input: VideoGenerationInput): Promise<VideoGenerationOutput>;
  checkStatus(jobId: string): Promise<VideoGenerationOutput>;
  download(jobId: string, outputPath: string): Promise<string>; // returns local path
}

// ─────────────────────────────────────────────
// VOICE PROVIDER
// ─────────────────────────────────────────────

export interface VoiceGenerationInput {
  text: string;
  voiceId?: string;         // provider-specific voice ID
  stability?: number;       // 0-1
  similarityBoost?: number; // 0-1
  outputFormat?: "mp3" | "wav";
  outputPath?: string;      // destination path for the generated audio file
}

export interface VoiceGenerationOutput {
  status: "completed" | "failed";
  localPath?: string;
  durationSeconds?: number;
  error?: string;
}

export interface IVoiceProvider {
  readonly name: string;
  generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput>;
  listVoices(): Promise<Array<{ id: string; name: string }>>;
}

// ─────────────────────────────────────────────
// MUSIC PROVIDER
// ─────────────────────────────────────────────

export interface MusicGenerationInput {
  mood?: string;          // "epic" | "calm" | "emotional" | etc.
  genre?: string;
  durationSeconds?: number;
  prompt?: string;        // free-text music description
  outputFormat?: "mp3" | "wav";
}

export interface MusicGenerationOutput {
  status: "completed" | "failed" | "queued";
  jobId?: string;         // for async providers
  localPath?: string;
  durationSeconds?: number;
  providerName: string;   // which provider actually handled this
  error?: string;
}

export interface IMusicProvider {
  readonly name: string;
  readonly isAsync: boolean; // true if provider returns a jobId to poll
  generate(input: MusicGenerationInput): Promise<MusicGenerationOutput>;
  checkStatus?(jobId: string): Promise<MusicGenerationOutput>;
}

// ─────────────────────────────────────────────
// ALERT PROVIDER
// ─────────────────────────────────────────────

export interface AlertInput {
  message: string;
  contentItemId?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertOutput {
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
}

export interface IAlertProvider {
  readonly name: string;
  send(input: AlertInput): Promise<AlertOutput>;
}
