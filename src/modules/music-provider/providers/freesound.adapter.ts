// GioHomeStudio — Freesound Provider Adapter
// Status: STUB — not yet implemented.
//
// Freesound (https://freesound.org/docs/api) provides CC-licensed audio clips —
// primarily ambience, sound effects, and atmospheric textures.
// Better suited to background ambience than full music tracks.
//
// Planned use in GioHomeStudio:
//   - Phase 3: ambient soundscapes layered under voice (rain, crowd, nature, etc.)
//   - Not the primary music track — used as a separate "ambience" layer
//
// How it will work:
//   1. Map mood → Freesound search terms (e.g. "epic" → "orchestral hit impact")
//   2. GET /search/text/ with query + duration filter + license filter
//   3. Pick best match
//   4. Download via /sounds/{id}/download/
//   5. Return metadata with CC license + attribution
//
// Required env vars:
//   FREESOUND_API_KEY  — from https://freesound.org/apiv2/apply/

import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";

class FreesoundProvider implements IMusicProvider {
  readonly name = "freesound";
  readonly isAsync = false;

  async generate(_input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    return {
      status: "failed",
      providerName: this.name,
      error: "Freesound provider is not yet implemented.",
    };
  }
}

export const freesoundProvider: IMusicProvider = new FreesoundProvider();
