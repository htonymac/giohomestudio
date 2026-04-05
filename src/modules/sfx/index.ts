// GioHomeStudio — SFX Module
//
// Maps sound event names to local MP3 files in storage/sfx/.
// Files are optional — the module returns null for missing files
// so the pipeline skips SFX gracefully rather than failing.
//
// To add SFX: drop MP3 files into storage/sfx/ using the exact
// filenames listed in SFX_LIBRARY below.

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export interface SFXFile {
  event: string;
  filename: string;
  description: string;
  category: "weather" | "crowd" | "action" | "nature" | "urban" | "horror" | "animal" | "vehicle";
}

// Master SFX library — event name → file info
// Drop matching MP3 files in storage/sfx/ to activate each effect.
export const SFX_LIBRARY: SFXFile[] = [
  // Weather
  { event: "thunder",       filename: "thunder.mp3",        description: "Thunderclap rumble",               category: "weather" },
  { event: "rain_light",    filename: "rain_light.mp3",     description: "Light rain / drizzle",             category: "weather" },
  { event: "rain_heavy",    filename: "rain_heavy.mp3",     description: "Heavy downpour",                   category: "weather" },
  { event: "wind",          filename: "wind.mp3",           description: "Howling wind",                     category: "weather" },
  { event: "storm",         filename: "storm.mp3",          description: "Full storm ambience",              category: "weather" },
  // Crowd
  { event: "crowd_cheer",   filename: "crowd_cheer.mp3",    description: "Crowd cheering",                   category: "crowd"   },
  { event: "crowd_murmur",  filename: "crowd_murmur.mp3",   description: "Crowd murmuring / background",     category: "crowd"   },
  { event: "crowd_panic",   filename: "crowd_panic.mp3",    description: "Crowd in panic / screaming",       category: "crowd"   },
  // Action
  { event: "gunshot",       filename: "gunshot.mp3",        description: "Single gunshot",                   category: "action"  },
  { event: "explosion",     filename: "explosion.mp3",      description: "Large explosion",                  category: "action"  },
  { event: "sword_clash",   filename: "sword_clash.mp3",    description: "Sword / metal clash",              category: "action"  },
  { event: "footsteps",     filename: "footsteps.mp3",      description: "Walking footsteps",                category: "action"  },
  { event: "footsteps_run", filename: "footsteps_run.mp3",  description: "Running footsteps",                category: "action"  },
  { event: "fire_crackling",filename: "fire_crackling.mp3", description: "Crackling fire",                   category: "action"  },
  { event: "door_creak",    filename: "door_creak.mp3",     description: "Creaking door",                    category: "action"  },
  { event: "horse_gallop",  filename: "horse_gallop.mp3",   description: "Horse galloping",                  category: "action"  },
  // Nature
  { event: "ocean_waves",   filename: "ocean_waves.mp3",    description: "Ocean waves on shore",             category: "nature"  },
  { event: "forest_ambience",filename:"forest_ambience.mp3",description: "Forest birds / nature ambience",   category: "nature"  },
  { event: "river_stream",  filename: "river_stream.mp3",   description: "Flowing river / stream",           category: "nature"  },
  // Urban
  { event: "city_traffic",  filename: "city_traffic.mp3",   description: "Urban traffic / city ambience",   category: "urban"   },
  { event: "church_bell",   filename: "church_bell.mp3",    description: "Church bell / clock tower chime", category: "urban"   },
  { event: "market_noise",  filename: "market_noise.mp3",   description: "Busy market / marketplace noise", category: "urban"   },
  // Horror / suspense
  { event: "horror_sting",  filename: "horror_sting.mp3",   description: "Horror suspense sting",           category: "horror"  },
  { event: "heartbeat",     filename: "heartbeat.mp3",      description: "Tense heartbeat",                 category: "horror"  },
  // Animal
  { event: "dog_bark",      filename: "dog_bark.mp3",       description: "Dog barking",                     category: "animal"  },
  // Vehicle
  { event: "engine_hum",    filename: "engine_hum.mp3",     description: "Car/vehicle engine idle hum",     category: "vehicle" },
  { event: "road_noise",    filename: "road_noise.mp3",     description: "Road noise / tyre on tarmac",     category: "vehicle" },
  { event: "cabin_ambience",filename: "cabin_ambience.mp3", description: "Interior car cabin ambience",     category: "vehicle" },
];

const SFX_MAP = new Map<string, SFXFile>(SFX_LIBRARY.map(s => [s.event, s]));

export function getSFXPath(event: string): string | null {
  const entry = SFX_MAP.get(event);
  if (!entry) return null;
  const fullPath = path.join(env.storagePath, "sfx", entry.filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

// Resolve a list of event names to available local paths (skips missing files)
export function resolveSFXPaths(events: string[]): string[] {
  const paths: string[] = [];
  for (const event of events) {
    const p = getSFXPath(event);
    if (p) paths.push(p);
    else console.warn(`[SFX] File not found for event "${event}" — skipping`);
  }
  return paths;
}

// List available SFX events (files that actually exist in storage/sfx/)
export function listAvailableSFX(): SFXFile[] {
  return SFX_LIBRARY.filter(s => {
    const p = path.join(env.storagePath, "sfx", s.filename);
    return fs.existsSync(p);
  });
}

// ── Source note sidecar ─────────────────────────────────────────────────────
// Reads storage/sfx/sources.json — written by the UI via /api/sfx/source-notes.
// Returns empty object on missing or malformed file (never throws).

export interface SFXSourceNote {
  key: string;
  filename: string;
  sourceSite: string;
  sourceUrl: string;
  attributionNote: string;
  importNote: string;
  safeForAutoMode: boolean;
  qualityRating: "" | "low" | "good" | "excellent";
  updatedAt?: string;
}

function loadSourceNotes(): Record<string, SFXSourceNote> {
  const sidecarPath = path.join(env.storagePath, "sfx", "sources.json");
  if (!fs.existsSync(sidecarPath)) return {};
  try {
    const raw = fs.readFileSync(sidecarPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, SFXSourceNote>;
  } catch {
    return {};
  }
}

// Auto-selection resolver — only returns paths for events explicitly marked
// safeForAutoMode: true in sources.json.
// Used by the pipeline for supervisor-detected events (auto-mapped from script text).
// Manual [SFX: event] script tags bypass this check — use resolveSFXPaths() for those.
export function resolveAutoSFXPaths(events: string[]): string[] {
  const notes = loadSourceNotes();
  const paths: string[] = [];
  for (const event of events) {
    const note = notes[event];
    if (!note?.safeForAutoMode) {
      console.warn(`[SFX Auto] "${event}" not marked safe for auto mode — skipping auto-use`);
      continue;
    }
    const p = getSFXPath(event);
    if (p) paths.push(p);
    else console.warn(`[SFX Auto] File not found for event "${event}" — skipping`);
  }
  return paths;
}
