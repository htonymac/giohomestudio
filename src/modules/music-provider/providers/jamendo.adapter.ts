// GioHomeStudio — Jamendo Music Provider Adapter
// Status: STUB — not yet implemented.
//
// Jamendo (https://developer.jamendo.com) provides CC-licensed music
// searchable by mood, genre, and tags. Free tier: 50 req/day.
//
// How it will work:
//   1. Map mood → Jamendo tags (e.g. "epic" → "epic,cinematic,orchestral")
//   2. GET /v3.0/tracks with tags + duration range + format=mp31
//   3. Pick best match by duration proximity
//   4. Download the mp31 (128kbps mp3) stream URL to outputPath
//   5. Return track metadata including CC license + attribution string
//
// Required env vars:
//   JAMENDO_CLIENT_ID  — from https://devportal.jamendo.com

import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";

class JamendoMusicProvider implements IMusicProvider {
  readonly name = "jamendo";
  readonly isAsync = false;

  async generate(_input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    return {
      status: "failed",
      providerName: this.name,
      error: "Jamendo provider is not yet implemented.",
    };
  }
}

export const jamendoMusicProvider: IMusicProvider = new JamendoMusicProvider();
