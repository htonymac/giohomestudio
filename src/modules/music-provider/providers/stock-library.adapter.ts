// GioHomeStudio — Stock Library Music Provider Adapter
// Selects a local stock file using a priority-based lookup.
// No external API required — works offline.
//
// File naming convention for stock/music/ directory:
//
//   Priority 1 (most specific):   {mood}_{genre}_{region}.mp3
//     e.g.  epic_orchestral_western.mp3
//           calm_acoustic_latin.mp3
//
//   Priority 2 (genre only):      {mood}_{genre}.mp3
//     e.g.  epic_orchestral.mp3
//           calm_acoustic.mp3
//
//   Priority 3 (region only):     {mood}_{region}.mp3
//     e.g.  epic_western.mp3
//           calm_latin.mp3
//
//   Priority 4 (mood only):       {mood}.mp3
//     e.g.  epic.mp3   calm.mp3
//
//   Priority 5 (legacy names):    existing bundled files
//     epic_cinematic.mp3, calm_ambient.mp3, etc.
//
//   Priority 6 (fallback):        default_background.mp3
//
// Any file placed in storage/music/stock/ matching these names is
// automatically activated without code changes.

import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";
import { mockMusicProvider } from "./mock-music.adapter";

// Legacy mood → filename map (Priority 5 — kept for backwards compatibility)
const LEGACY_MOOD_MAP: Record<string, string> = {
  epic:      "epic_cinematic.mp3",
  calm:      "calm_ambient.mp3",
  emotional: "emotional_piano.mp3",
  upbeat:    "upbeat_pop.mp3",
  dramatic:  "dramatic_orchestral.mp3",
  default:   "default_background.mp3",
};

function findStockFile(stockDir: string, candidates: string[]): string | null {
  for (const filename of candidates) {
    const fullPath = path.join(stockDir, filename);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function buildCandidates(mood: string, genre?: string, region?: string): string[] {
  const m = mood.toLowerCase();
  const g = genre?.toLowerCase();
  const r = region?.toLowerCase();

  const candidates: string[] = [];

  // Priority 1: mood + genre + region (most specific)
  if (g && r) candidates.push(`${m}_${g}_${r}.mp3`);

  // Priority 2: mood + genre
  if (g) candidates.push(`${m}_${g}.mp3`);

  // Priority 3: mood + region
  if (r) candidates.push(`${m}_${r}.mp3`);

  // Priority 4: mood alone (simple naming)
  candidates.push(`${m}.mp3`);

  // Priority 5: legacy descriptive names
  const legacy = LEGACY_MOOD_MAP[m];
  if (legacy) candidates.push(legacy);

  // Priority 6: default fallback
  candidates.push("default_background.mp3");

  return candidates;
}

class StockLibraryMusicProvider implements IMusicProvider {
  readonly name = "stock_library";
  readonly isAsync = false;

  async generate(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    const mood = input.mood?.toLowerCase() ?? "default";
    const stockDir = path.join(env.storagePath, "music", "stock");
    const candidates = buildCandidates(mood, input.genre, input.region);

    const trackPath = findStockFile(stockDir, candidates);

    if (!trackPath) {
      console.log(
        `[StockLibrary] No stock file found for mood="${mood}" genre="${input.genre ?? "-"}" region="${input.region ?? "-"}". ` +
        `Tried: [${candidates.join(", ")}] — falling back to mock_music`
      );
      return mockMusicProvider.generate(input);
    }

    const filename = path.basename(trackPath);
    const selectedBy = candidates.indexOf(filename) + 1;
    console.log(
      `[StockLibrary] Selected (priority ${selectedBy}): ${filename} ` +
      `(mood=${mood} genre=${input.genre ?? "-"} region=${input.region ?? "-"})`
    );

    return {
      status: "completed",
      localPath: trackPath,
      providerName: this.name,
      track: {
        title: filename.replace(".mp3", "").replace(/_/g, " "),
        license: "stock",
      },
    };
  }
}

export const stockLibraryMusicProvider: IMusicProvider = new StockLibraryMusicProvider();
