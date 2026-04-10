// GHS Intelligence Cache — Reusable planning skeletons
//
// Caches genre/mood/dance pattern intelligence to avoid redundant AI calls.
// Rule: ONLY cache reusable skeletons, NEVER cache final personalized outputs.
//
// Formula: Cached Blueprint + Live Personalization = Unique Result
//
// What to cache: genre structures, dance grammar, music pacing templates,
//   camera grammar, environment patterns, children learning structures
// What to NEVER cache: final storylines, user narration, personalized prompts,
//   emotional arcs, character identity, final scene lists

import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = path.join(process.cwd(), "storage", "cache", "intelligence");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  key: string;
  data: unknown;
  createdAt: number;
  hits: number;
}

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(key: string): string {
  // Hash the key to a safe filename
  const hash = Buffer.from(key).toString("base64url").slice(0, 40);
  return path.join(CACHE_DIR, `${hash}.json`);
}

/**
 * Generate a cache key from the inputs that define a reusable skeleton.
 * Only include genre-level attributes, NOT user-specific content.
 */
export function makeCacheKey(params: {
  type: "movie" | "music-video" | "dance" | "scene";
  genre?: string;
  mood?: string;
  energy?: string;
  style?: string;
  format?: string;
}): string {
  return [
    params.type,
    params.genre?.toLowerCase().trim(),
    params.mood?.toLowerCase().trim(),
    params.energy?.toLowerCase().trim(),
    params.style?.toLowerCase().trim(),
    params.format?.toLowerCase().trim(),
  ].filter(Boolean).join("|");
}

/**
 * Get cached intelligence skeleton. Returns null if not found or expired.
 */
export function getCached(key: string): unknown | null {
  ensureDir();
  const filePath = cacheFilePath(key);

  try {
    if (!fs.existsSync(filePath)) return null;
    const entry: CacheEntry = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Check TTL
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
      fs.unlinkSync(filePath); // expired
      return null;
    }

    // Increment hit counter
    entry.hits += 1;
    fs.writeFileSync(filePath, JSON.stringify(entry));

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Save an intelligence skeleton to cache.
 * ONLY call this for reusable patterns — never for personalized outputs.
 */
export function setCache(key: string, data: unknown): void {
  ensureDir();
  const filePath = cacheFilePath(key);

  const entry: CacheEntry = {
    key,
    data,
    createdAt: Date.now(),
    hits: 0,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(entry));
  } catch { /* ignore write failures */ }
}

/**
 * Get cache stats for monitoring.
 */
export function getCacheStats(): { totalEntries: number; totalHits: number; oldestDays: number } {
  ensureDir();
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith(".json"));
    let totalHits = 0;
    let oldestCreated = Date.now();

    for (const f of files) {
      try {
        const entry: CacheEntry = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), "utf-8"));
        totalHits += entry.hits;
        if (entry.createdAt < oldestCreated) oldestCreated = entry.createdAt;
      } catch { /* skip corrupt entries */ }
    }

    return {
      totalEntries: files.length,
      totalHits,
      oldestDays: Math.round((Date.now() - oldestCreated) / (24 * 60 * 60 * 1000)),
    };
  } catch {
    return { totalEntries: 0, totalHits: 0, oldestDays: 0 };
  }
}
