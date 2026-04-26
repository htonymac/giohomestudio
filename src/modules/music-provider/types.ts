// GioHomeStudio — Music Provider Abstraction Layer
// Generic provider interface and I/O types.
// Pipeline never imports a concrete adapter directly — only this file.

export interface MusicGenerateInput {
  prompt: string;          // user prompt or scene description
  durationSeconds: number; // target track length
  genre?: string;          // hint for provider
  mood?: string;           // hint for provider
  hasLyrics: boolean;      // true = lyrical/vocal track (routes to kie), false = instrumental
}

export interface MusicGenerateOutput {
  audioUrl: string;        // /api/media/... or external URL
  durationSeconds: number;
  costUsd: number;
  providerKey: string;
  modelName: string;
}

export interface MusicProviderCapabilities {
  maxDurationSeconds: number;
  supportsLyrics: boolean;
  supportsGenre: boolean;
  costPerTrack: number;
  quality: "draft" | "standard" | "high" | "best";
}

export interface MusicProviderAdapter {
  name: string;
  generate(input: MusicGenerateInput): Promise<MusicGenerateOutput>;
  getCapabilities(): MusicProviderCapabilities;
}
