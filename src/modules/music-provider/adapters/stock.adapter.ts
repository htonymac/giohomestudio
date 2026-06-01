// GioHomeStudio — Stock Library Adapter
// Pure local — picks from storage/music/stock/*.mp3 based on prompt keywords.
// Always succeeds. Zero cost. Final fallback when all other providers fail.
// Server-side only (uses fs/path).

import * as path from "path";
import * as fs from "fs";
import type { MusicGenerateInput, MusicGenerateOutput, MusicProviderCapabilities, MusicProviderAdapter } from "../types";

// Henry 2026-06-01: read the explicit manifest so genre/mood requests can pick
// from the catalog instead of falling through to random filename heuristics.
let cachedManifest: Array<{
  filename: string;
  mood?: string;
  genre?: string;
  safeForFreeUser?: boolean;
  blocked?: boolean;
}> | null = null;

function loadManifest(stockDir: string): typeof cachedManifest {
  if (cachedManifest) return cachedManifest;
  const manifestPath = path.join(stockDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      cachedManifest = arr as NonNullable<typeof cachedManifest>;
      return cachedManifest;
    }
  } catch { /* fall through */ }
  return [];
}

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

// Henry 2026-05-31: track WHY a file was picked so the UI can warn the user
// when their requested genre (e.g. "afrobeats") could not be matched and we
// fell back to a generic track. "voice is afro, sound is default" frustration.
export type PickResult = { path: string; matchQuality: "exact" | "approximate" | "fallback" };

function pickTrack(stockDir: string, prompt: string, genre?: string, mood?: string): PickResult | null {
  const searchText = `${prompt} ${genre ?? ""} ${mood ?? ""}`.toLowerCase();

  // Try manifest-based match first — score each entry by genre + mood overlap with
  // the requested searchText. Returns highest-scoring entry's filename.
  const manifest = loadManifest(stockDir);
  const safeOnly = manifest ? manifest.filter(e => e.safeForFreeUser === true && !e.blocked) : [];
  if (safeOnly.length > 0) {
    let best: { entry: typeof safeOnly[number]; score: number } | null = null;
    for (const entry of safeOnly) {
      let score = 0;
      if (entry.genre && searchText.includes(entry.genre.toLowerCase())) score += 3;
      if (entry.mood && searchText.includes(entry.mood.toLowerCase())) score += 2;
      // bonus: filename includes a request keyword
      const fn = entry.filename.toLowerCase();
      for (const kw of searchText.split(/\s+/).filter(Boolean)) {
        if (kw.length >= 4 && fn.includes(kw)) score += 1;
      }
      if (!best || score > best.score) {
        // RANDOMIZE among ties so same request doesn't always return same track
        if (!best || score > best.score || Math.random() < 0.5) {
          best = { entry, score };
        }
      }
    }
    if (best && best.score > 0) {
      const fullPath = path.join(stockDir, best.entry.filename);
      if (fs.existsSync(fullPath)) {
        return { path: fullPath, matchQuality: best.score >= 5 ? "exact" : "approximate" };
      }
    }
  }

  // Check keyword map — EXACT only if the requested keyword file exists by EXACT name.
  for (const { keywords, files } of KEYWORD_MAP) {
    const matchedKeyword = keywords.find(k => searchText.includes(k));
    if (matchedKeyword) {
      // Look for a filename that contains the matched keyword — that's "exact".
      const exactFiles = files.filter(f => f.toLowerCase().includes(matchedKeyword));
      const exact = findFile(stockDir, exactFiles);
      if (exact) return { path: exact, matchQuality: "exact" };
      // Found a different file from the same keyword group — "approximate".
      const approx = findFile(stockDir, files);
      if (approx) return { path: approx, matchQuality: "approximate" };
    }
  }

  // Sweep BOTH the top-level stockDir AND the freepd/ folder so the library is
  // ~250+ tracks instead of just 14. Random pick from all mp3s as last-resort
  // fallback so users at least get variety.
  const allCandidates: string[] = [];
  if (fs.existsSync(stockDir)) {
    for (const f of fs.readdirSync(stockDir)) {
      if (f.endsWith(".mp3")) allCandidates.push(path.join(stockDir, f));
    }
    const freepdDir = path.join(stockDir, "freepd");
    if (fs.existsSync(freepdDir)) {
      for (const f of fs.readdirSync(freepdDir)) {
        if (f.endsWith(".mp3")) allCandidates.push(path.join(freepdDir, f));
      }
    }
  }
  if (allCandidates.length === 0) return null;
  return { path: allCandidates[Math.floor(Math.random() * allCandidates.length)], matchQuality: "fallback" };
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
    const picked = pickTrack(stockDir, input.prompt, input.genre, input.mood);

    if (picked) {
      // Resolve to a SERVED URL relative to /api/media/music/stock/ (handles freepd/ too).
      const rel = path.relative(stockDir, picked.path).replace(/\\/g, "/");
      const audioUrl = `/api/media/music/stock/${rel}`;
      // Surface match quality so the route can warn the user when their requested
      // genre (afrobeats etc) could not be matched and we returned a generic track.
      // Henry 2026-05-31: "voice afro, sound default" frustration root cause.
      const qualitySuffix = picked.matchQuality === "exact" ? ""
        : picked.matchQuality === "approximate" ? "/approximate"
        : "/fallback-generic";

      return {
        audioUrl,
        durationSeconds: input.durationSeconds,
        costUsd: 0,
        providerKey: "stock",
        modelName: `stock_library${qualitySuffix}`,
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
