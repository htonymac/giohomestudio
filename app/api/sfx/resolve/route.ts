// POST /api/sfx/resolve — SFX Retrieval Chain
// Finds matching sound effects for scene needs
// Chain: Internal Library → Freesound → AI-Generated → Flag for Review
//
// Input: { needs: ["footsteps", "rain", "gunshot type: revolver"] }
// Output: { resolved: [{ need, source, match, confidence, url }] }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

// Internal SFX library mapping (from our 48 generated SFX + 113 catalogued)
const INTERNAL_LIBRARY: Record<string, { file: string; category: string }> = {
  // Transitions
  whoosh: { file: "whoosh.mp3", category: "transitions" },
  riser: { file: "riser.mp3", category: "transitions" },
  swoosh: { file: "swoosh.mp3", category: "transitions" },
  sparkle: { file: "sparkle.mp3", category: "transitions" },
  pop: { file: "pop.mp3", category: "transitions" },
  snap: { file: "snap.mp3", category: "transitions" },
  ding: { file: "ding.mp3", category: "transitions" },
  // Beats
  bass_drop: { file: "bass_drop.mp3", category: "beats" },
  kick: { file: "kick.mp3", category: "beats" },
  snare: { file: "snare.mp3", category: "beats" },
  hi_hat: { file: "hi_hat.mp3", category: "beats" },
  drum_roll: { file: "drum_roll.mp3", category: "beats" },
  // Weather
  thunder: { file: "thunder.mp3", category: "weather" },
  rain: { file: "rain.mp3", category: "weather" },
  heavy_rain: { file: "heavy_rain.mp3", category: "weather" },
  wind: { file: "wind.mp3", category: "weather" },
  // Nature
  ocean: { file: "ocean.mp3", category: "nature" },
  forest_birds: { file: "forest_birds.mp3", category: "nature" },
  deep_ambience: { file: "deep_ambience.mp3", category: "nature" },
  // Urban
  city_traffic: { file: "city_traffic.mp3", category: "urban" },
  siren: { file: "siren.mp3", category: "urban" },
  bell_church: { file: "bell_church.mp3", category: "urban" },
  crowd: { file: "crowd.mp3", category: "urban" },
  // Horror/Tension
  suspense_drone: { file: "suspense_drone.mp3", category: "horror" },
  tension_build: { file: "tension_build.mp3", category: "horror" },
  heartbeat: { file: "heartbeat.mp3", category: "horror" },
  // Tech
  click: { file: "click.mp3", category: "tech" },
  beep: { file: "beep.mp3", category: "tech" },
  notification: { file: "notification.mp3", category: "tech" },
  alarm: { file: "alarm.mp3", category: "tech" },
  camera_shutter: { file: "camera_shutter.mp3", category: "tech" },
  typing: { file: "typing.mp3", category: "tech" },
  error: { file: "error.mp3", category: "tech" },
  static: { file: "static.mp3", category: "tech" },
  // Household
  door_knock: { file: "door_knock.mp3", category: "household" },
  phone_ring: { file: "phone_ring.mp3", category: "household" },
  coin: { file: "coin.mp3", category: "household" },
  // Vehicle
  motor_rev: { file: "motor_rev.mp3", category: "vehicle" },
  // Impact
  explosion: { file: "explosion.mp3", category: "impact" },
  boom: { file: "boom.mp3", category: "impact" },
  rumble: { file: "rumble.mp3", category: "impact" },
  sub_bass_hit: { file: "sub_bass_hit.mp3", category: "impact" },
};

// Keyword → internal SFX mapping for fuzzy matching
const KEYWORD_MAP: Record<string, string> = {
  footstep: "click", feet: "click", walking: "click", running: "click",
  gunshot: "explosion", gun: "explosion", shot: "explosion", weapon: "explosion",
  breathing: "deep_ambience", breath: "deep_ambience",
  scream: "tension_build", shout: "tension_build",
  water: "ocean", splash: "ocean", river: "ocean",
  fire: "static", flame: "static", burning: "static",
  glass: "snap", break: "snap", shatter: "snap",
  metal: "click", clang: "click",
  wood: "door_knock", creak: "door_knock",
  car: "motor_rev", engine: "motor_rev", vehicle: "motor_rev",
  bird: "forest_birds", animal: "forest_birds",
  market: "crowd", street: "city_traffic",
  silence: "deep_ambience", quiet: "deep_ambience",
  suspense: "suspense_drone", tension: "tension_build",
  impact: "boom", hit: "sub_bass_hit", punch: "sub_bass_hit",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const needs: string[] = body.needs ?? [];

    if (needs.length === 0) {
      return NextResponse.json({ error: "No SFX needs provided" }, { status: 400 });
    }

    const sfxDir = path.join(env.storagePath, "sfx");
    const resolved = [];
    for (const need of needs) {
      const lower = need.toLowerCase();
      let found = false;

      // ── Source 1: Direct internal library match ──
      for (const [key, info] of Object.entries(INTERNAL_LIBRARY)) {
        if (lower.includes(key) || key.includes(lower.split(" ")[0])) {
          const filePath = path.join(sfxDir, info.file);
          if (fs.existsSync(filePath)) {
            resolved.push({ need, source: "internal", match: key, file: info.file, url: `/api/media/sfx/${info.file}`, category: info.category, confidence: "high" });
            found = true; break;
          }
        }
      }
      if (found) continue;

      // ── Source 2: Keyword fuzzy match ──
      for (const [keyword, sfxKey] of Object.entries(KEYWORD_MAP)) {
        if (lower.includes(keyword)) {
          const info = INTERNAL_LIBRARY[sfxKey];
          if (info) {
            const filePath = path.join(sfxDir, info.file);
            if (fs.existsSync(filePath)) {
              resolved.push({ need, source: "internal_fuzzy", match: sfxKey, file: info.file, url: `/api/media/sfx/${info.file}`, category: info.category, confidence: "medium" });
              found = true; break;
            }
          }
        }
      }
      if (found) continue;

      // ── Source 3: Freesound API search (if key available) ──
      const freesoundKey = process.env.FREESOUND_API_KEY;
      if (freesoundKey) {
        try {
          const searchRes = await fetch(`https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(need)}&filter=duration:[0.1 TO 10]&fields=id,name,previews,duration&page_size=1&token=${freesoundKey}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const results = (searchData.results as Array<Record<string, unknown>>) ?? [];
            if (results.length > 0) {
              const hit = results[0];
              const previews = (hit.previews as Record<string, string>) ?? {};
              const previewUrl = previews["preview-hq-mp3"];
              if (previewUrl) {
                resolved.push({ need, source: "freesound", match: hit.name as string, file: null, url: previewUrl, category: "external", confidence: "medium", suggestion: `Found on Freesound: ${hit.name}` });
                continue;
              }
            }
          }
        } catch { /* Freesound unavailable */ }
      }

      // ── Source 4: Flag for AI generation ──
      resolved.push({ need, source: "needs_generation", match: null, file: null, url: null, category: "unknown", confidence: "low", suggestion: `Not found. Needs AI generation or manual upload.` });
    }

    const stats = {
      total: resolved.length,
      high_confidence: resolved.filter(r => r.confidence === "high").length,
      medium_confidence: resolved.filter(r => r.confidence === "medium").length,
      needs_generation: resolved.filter(r => r.confidence === "low").length,
    };

    return NextResponse.json({ resolved, stats });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
