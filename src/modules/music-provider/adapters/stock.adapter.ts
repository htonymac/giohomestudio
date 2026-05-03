// GioHomeStudio — Stock Library Adapter
// Pure local — picks from storage/music/stock/*.mp3 based on prompt keywords.
// Always succeeds. Zero cost. Final fallback when all other providers fail.
// Server-side only (uses fs/path).

import * as path from "path";
import * as fs from "fs";
import type { MusicGenerateInput, MusicGenerateOutput, MusicProviderCapabilities, MusicProviderAdapter } from "../types";

// Keyword → ordered list of candidate filenames (most specific first)
const KEYWORD_MAP: Array<{ keywords: string[]; files: string[] }> = [
  {
    keywords: ["afrobeats", "afropop", "afro", "naija", "nigerian"],
    files: ["afrobeats.mp3", "afro_party.mp3", "upbeat.mp3", "upbeat_pop.mp3"],
  },
  {
    keywords: ["calm", "peaceful", "relax", "soft", "gentle", "meditation"],
    files: ["calm.mp3", "calm_ambient.mp3", "peaceful.mp3"],
  },
  {
    keywords: ["upbeat", "dance", "party", "energy", "fun", "festive"],
    files: ["upbeat.mp3", "dance.mp3", "upbeat_pop.mp3"],
  },
  {
    keywords: ["epic", "cinematic", "dramatic", "orchestral", "war", "battle", "heroic"],
    files: ["epic.mp3", "epic_cinematic.mp3", "dramatic_orchestral.mp3"],
  },
  {
    keywords: ["emotional", "sad", "melancholy", "piano", "heartbreak"],
    files: ["emotional.mp3", "emotional_piano.mp3"],
  },
];

const FALLBACK_FILES = [
  "default_background.mp3",
  "calm_ambient.mp3",
  "upbeat_pop.mp3",
  "epic_cinematic.mp3",
];

function getStockDir(): string {
  const base = process.env.STORAGE_BASE_PATH ?? "./storage";
  return path.resolve(process.cwd(), base, "music", "stock");
}

function findFile(stockDir: string, candidates: string[]): string | null {
  const found = candidates.map(f => path.join(stockDir, f)).filter(p => fs.existsSync(p));
  if (found.length === 0) return null;
  // Randomize so same keyword doesn't always return the same track
  return found[Math.floor(Math.random() * found.length)];
}

function pickTrack(stockDir: string, prompt: string, genre?: string, mood?: string): string | null {
  const searchText = `${prompt} ${genre ?? ""} ${mood ?? ""}`.toLowerCase();

  // Check keyword map
  for (const { keywords, files } of KEYWORD_MAP) {
    if (keywords.some(k => searchText.includes(k))) {
      const found = findFile(stockDir, files);
      if (found) return found;
    }
  }

  // Try fallbacks
  const found = findFile(stockDir, FALLBACK_FILES);
  if (found) return found;

  // Last resort: any .mp3 in the directory
  if (!fs.existsSync(stockDir)) return null;
  const all = fs.readdirSync(stockDir).filter(f => f.endsWith(".mp3"));
  if (all.length > 0) {
    return path.join(stockDir, all[Math.floor(Math.random() * all.length)]);
  }

  return null;
}

class StockAdapter implements MusicProviderAdapter {
  readonly name = "stock";

  getCapabilities(): MusicProviderCapabilities {
    return {
      maxDurationSeconds: 120,
      supportsLyrics: false,
      supportsGenre: true,
      costPerTrack: 0,
      quality: "draft",
    };
  }

  async generate(input: MusicGenerateInput): Promise<MusicGenerateOutput> {
    const stockDir = getStockDir();
    const trackPath = pickTrack(stockDir, input.prompt, input.genre, input.mood);

    if (trackPath) {
      // Convert absolute disk path → served URL
      const filename = path.basename(trackPath);
      const audioUrl = `/api/media/music/stock/${filename}`;

      return {
        audioUrl,
        durationSeconds: input.durationSeconds,
        costUsd: 0,
        providerKey: "stock",
        modelName: "stock_library",
      };
    }

    // No stock files found — return a silent/empty signal rather than throwing
    // so the route can handle gracefully
    console.warn("[stock] No stock files found in", stockDir, "— returning placeholder URL");
    return {
      audioUrl: "/api/media/music/stock/silence.mp3",
      durationSeconds: input.durationSeconds,
      costUsd: 0,
      providerKey: "stock",
      modelName: "stock_library/empty",
    };
  }
}

export const stockAdapter: MusicProviderAdapter = new StockAdapter();
