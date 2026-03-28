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

// Describes the license under which a track may be used.
// Always store this alongside any downloaded track.
export type MusicLicense =
  | "cc0"           // public domain — no attribution required
  | "cc-by"         // attribution required
  | "cc-by-sa"      // attribution + share-alike
  | "cc-by-nc"      // attribution, non-commercial only
  | "royalty-free"  // provider-specific royalty-free license
  | "generated"     // AI-generated, provider owns the output license
  | "stock"         // local stock file, manually sourced
  | "unknown";

// Metadata returned when a real track is selected or generated.
// Stored on the content item so attribution can be shown if required.
export interface MusicTrackMetadata {
  trackId?: string;       // provider-side ID for the track
  title?: string;
  artist?: string;
  license: MusicLicense;
  attribution?: string;   // full attribution string required for cc-by licenses
  sourceUrl?: string;     // original track page URL (not the audio file URL)
  tags?: string[];
  durationSeconds?: number;
}

// Input accepted by all music providers.
// Search providers (Jamendo, Freesound) use mood/tags/searchQuery.
// Generation providers (Mubert) use mood/prompt/durationSeconds.
export interface MusicGenerationInput {
  mood?: string;            // "epic" | "calm" | "emotional" | "upbeat" | "dramatic"
  genre?: string;           // "cinematic" | "ambient" | "electronic" | etc.
  tags?: string[];          // additional search tags for Jamendo / Freesound
  searchQuery?: string;     // free-text search override (takes precedence over mood+tags)
  durationSeconds?: number; // target duration — search providers find closest match
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  prompt?: string;          // free-text prompt for generation providers (Mubert)
  outputFormat?: "mp3" | "wav";
  outputPath?: string;      // destination path on disk — provider writes here
}

export interface MusicGenerationOutput {
  status: "completed" | "failed" | "queued";
  jobId?: string;           // for async/generation providers that poll
  localPath?: string;       // absolute path to the downloaded/generated file
  durationSeconds?: number;
  providerName: string;
  track?: MusicTrackMetadata; // populated for search providers; null for stock/mock
  error?: string;
}

// The single interface every music provider adapter must implement.
//
// Two provider patterns:
//   Search providers (Jamendo, Freesound):
//     - search the catalog using mood/tags/searchQuery
//     - pick the best match
//     - download to outputPath
//     - return track metadata including license
//     - isAsync = false (HTTP calls, no polling needed)
//
//   Generation providers (Mubert):
//     - submit a generation job
//     - isAsync = true → pipeline calls checkStatus() until completed
//     - no track metadata (AI-generated)
//
// The pipeline only calls generate() + optionally checkStatus().
// It does not care which pattern is used underneath.
export interface IMusicProvider {
  readonly name: string;
  readonly isAsync: boolean;

  generate(input: MusicGenerationInput): Promise<MusicGenerationOutput>;

  // Only required for async/generation providers (isAsync = true).
  // Search providers do not need to implement this.
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
