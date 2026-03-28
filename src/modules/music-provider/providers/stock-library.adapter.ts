// GioHomeStudio — Stock Library Music Provider Adapter
// Default provider. Uses a local stock music file based on mood.
// No external API required — works offline.

import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";

// Map moods to bundled stock track filenames.
// Add .mp3 files to storage/music/stock/ to activate them.
const MOOD_TRACK_MAP: Record<string, string> = {
  epic:       "epic_cinematic.mp3",
  calm:       "calm_ambient.mp3",
  emotional:  "emotional_piano.mp3",
  upbeat:     "upbeat_pop.mp3",
  dramatic:   "dramatic_orchestral.mp3",
  default:    "default_background.mp3",
};

class StockLibraryMusicProvider implements IMusicProvider {
  readonly name = "stock_library";
  readonly isAsync = false;

  async generate(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    const mood = input.mood?.toLowerCase() ?? "default";
    const trackFile = MOOD_TRACK_MAP[mood] ?? MOOD_TRACK_MAP.default;
    const stockDir = path.join(env.storagePath, "music", "stock");
    const trackPath = path.join(stockDir, trackFile);

    if (!fs.existsSync(trackPath)) {
      // Fallback: return empty path without failing the pipeline
      return {
        status: "completed",
        localPath: undefined,
        providerName: this.name,
        // Music is optional — pipeline can proceed without it
      };
    }

    return {
      status: "completed",
      localPath: trackPath,
      providerName: this.name,
    };
  }
}

export const stockLibraryMusicProvider: IMusicProvider = new StockLibraryMusicProvider();
