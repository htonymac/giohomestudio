// GET /api/karaoke/beats-library
// Returns the curated set of beats users can record over.
// Query: ?safeOnly=1 (default) → only tracks tagged safeForFreeUser:true in manifest.
//        ?mood=X           → filter by mood (case-insensitive exact match)
//        ?genre=Y          → filter by genre (case-insensitive exact match)
//        ?tempo=X          → filter by tempo bucket: slow (<90 BPM), medium (90-129), fast (≥130), untagged (no BPM data)
// Returns: { beats: Array<{ id, filename, mood, genre, bpm, durationSec, audioUrl, license, attributionRequired }>, meta: { total, availableMoods, availableGenres, availableTempos } }
//
// Henry 2026-05-31: pick-beat-first surface so Free Mode users hear the beat
// before recording, rather than AI choosing music after the fact.

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface ManifestEntry {
  id: string;
  filename: string;
  mood: string;
  genre: string;
  description?: string;
  durationSec?: number | null;
  bpm?: number | null;
  license: string;
  attributionRequired?: boolean;
  safeForFreeUser?: boolean;
  blocked?: boolean;
}

const MANIFEST_PATH = path.join(process.cwd(), "storage", "music", "stock", "manifest.json");

// Returns true when the entry's BPM matches the requested tempo bucket.
// called for both manifest entries and freepd heuristic entries.
function bpmMatches(bpm: number | null | undefined, requested: string | null): boolean {
  if (!requested) return true;
  if (requested === "untagged") return bpm == null;
  if (bpm == null) return false;
  if (requested === "slow") return bpm < 90;
  if (requested === "medium") return bpm >= 90 && bpm < 130;
  if (requested === "fast") return bpm >= 130;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const safeOnly = req.nextUrl.searchParams.get("safeOnly") !== "0"; // default true
    const mood = req.nextUrl.searchParams.get("mood")?.toLowerCase() || null;
    const genre = req.nextUrl.searchParams.get("genre")?.toLowerCase() || null;
    const tempo = req.nextUrl.searchParams.get("tempo")?.toLowerCase() || null;

    let raw: string;
    try {
      raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
    } catch (readErr) {
      console.error("[beats-library] manifest read error:", readErr);
      return NextResponse.json(
        { error: "Could not read beats manifest" },
        { status: 500 }
      );
    }

    const entries: ManifestEntry[] = JSON.parse(raw);

    const filtered = safeOnly
      ? entries.filter((e) => e.safeForFreeUser === true && !e.blocked)
      : entries.filter((e) => !e.blocked);

    const filteredAll = filtered.filter((e) => {
      if (mood && (e.mood ?? "").toLowerCase() !== mood) return false;
      if (genre && (e.genre ?? "").toLowerCase() !== genre) return false;
      if (!bpmMatches(e.bpm, tempo)) return false;
      return true;
    });

    const beats = filteredAll.map((e) => ({
      id: e.id,
      filename: e.filename,
      mood: e.mood ?? "",
      genre: e.genre ?? "",
      bpm: e.bpm ?? null,
      durationSec: e.durationSec ?? null,
      audioUrl: `/api/media/music/stock/${e.filename}`,
      license: e.license ?? "Unknown",
      attributionRequired: !!e.attributionRequired,
    }));

    // Henry 2026-05-31: FALLBACK — scan storage/music/stock/freepd/ directly.
    // FreePD content is CC0 public domain by source, so every .mp3 in that dir
    // is automatically safe-for-free-user even when not listed in the manifest.
    // This keeps the picker functional during the manifest-build interim.
    if (safeOnly) {
      const freepdDir = path.join(process.cwd(), "storage", "music", "stock", "freepd");
      if (fs.existsSync(freepdDir)) {
        try {
          const seen = new Set(beats.map(b => b.filename));
          for (const f of fs.readdirSync(freepdDir)) {
            if (!f.toLowerCase().endsWith(".mp3")) continue;
            const relName = `freepd/${f}`;
            if (seen.has(relName)) continue;
            const lower = f.toLowerCase();
            // Heuristic tags — named entryMood/entryGenre to avoid shadowing the outer query params
            const entryMood: string = lower.includes("epic") || lower.includes("battle") || lower.includes("heroic") ? "epic"
              : lower.includes("calm") || lower.includes("dream") || lower.includes("ambient") ? "calm"
              : lower.includes("dramatic") || lower.includes("dark") ? "dramatic"
              : lower.includes("happy") || lower.includes("funky") || lower.includes("merry") || lower.includes("playful") ? "playful"
              : lower.includes("sad") || lower.includes("emotional") || lower.includes("reflect") ? "emotional"
              : lower.includes("mystery") || lower.includes("hidden") ? "mysterious"
              : lower.includes("adventure") || lower.includes("discovery") ? "adventure"
              : "neutral";
            const entryGenre: string = lower.includes("disco") ? "disco"
              : lower.includes("classical") || lower.includes("waltz") || lower.includes("overture") ? "classical"
              : lower.includes("bossa") || lower.includes("jazz") ? "jazz"
              : lower.includes("rock") ? "rock"
              : lower.includes("folk") || lower.includes("galway") ? "folk"
              : "cinematic";
            // Apply mood/genre/tempo query-param filter to freepd heuristic-tagged entries.
            // FreePD files have no BPM data, so they are always "untagged" for tempo.
            if (mood !== null && entryMood !== mood) continue;
            if (genre !== null && entryGenre !== genre) continue;
            if (!bpmMatches(null, tempo)) continue; // null BPM = untagged; skip unless tempo=untagged or no filter
            beats.push({
              id: `stock_freepd_${f.toLowerCase().replace(/\.mp3$/, "").replace(/[^a-z0-9]+/g, "_")}`,
              filename: relName,
              mood: entryMood,
              genre: entryGenre,
              bpm: null,
              durationSec: null,
              audioUrl: `/api/media/music/stock/${relName}`,
              license: "PUBLIC_DOMAIN",
              attributionRequired: false,
            });
          }
        } catch (scanErr) {
          console.warn("[beats-library] freepd scan failed:", scanErr);
        }
      }
    }

    return NextResponse.json({
      beats,
      meta: {
        total: beats.length,
        availableMoods: Array.from(new Set(beats.map(b => b.mood))).sort(),
        availableGenres: Array.from(new Set(beats.map(b => b.genre))).sort(),
        availableTempos: ["slow", "medium", "fast", "untagged"] as const,
      },
    });
  } catch (err) {
    console.error("[beats-library] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "beats-library failed" },
      { status: 500 }
    );
  }
}
