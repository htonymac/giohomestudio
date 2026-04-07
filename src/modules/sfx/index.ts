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
  category: "weather" | "crowd" | "action" | "nature" | "urban" | "horror" | "animal" | "vehicle" | "transition" | "music" | "voice" | "nigerian" | "household" | "tech" | "weapon" | "impact";
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

  // ── Transitions & Risers ──
  { event: "whoosh",          filename: "whoosh.mp3",           description: "Fast swoosh transition",          category: "transition" },
  { event: "whoosh_deep",     filename: "whoosh_deep.mp3",      description: "Deep bass swoosh",                category: "transition" },
  { event: "riser",           filename: "riser.mp3",            description: "Tension build riser",             category: "transition" },
  { event: "riser_reverse",   filename: "riser_reverse.mp3",    description: "Reverse cymbal riser",            category: "transition" },
  { event: "hit_impact",      filename: "hit_impact.mp3",       description: "Bass hit / impact thud",          category: "transition" },
  { event: "hit_cinematic",   filename: "hit_cinematic.mp3",    description: "Cinematic boom impact",           category: "transition" },
  { event: "tape_stop",       filename: "tape_stop.mp3",        description: "Tape stop / slowdown effect",     category: "transition" },
  { event: "glitch",          filename: "glitch.mp3",           description: "Digital glitch transition",       category: "transition" },

  // ── Weapons ──
  { event: "gunshot_single",  filename: "gunshot_single.mp3",   description: "Single gunshot",                  category: "weapon" },
  { event: "gunshot_burst",   filename: "gunshot_burst.mp3",    description: "Automatic burst fire",            category: "weapon" },
  { event: "gunshot_shotgun", filename: "gunshot_shotgun.mp3",  description: "Shotgun blast",                   category: "weapon" },
  { event: "gunshot_sniper",  filename: "gunshot_sniper.mp3",   description: "Sniper rifle shot",               category: "weapon" },
  { event: "reload",          filename: "reload.mp3",           description: "Gun reload click",                category: "weapon" },
  { event: "sword_slash",     filename: "sword_slash.mp3",      description: "Sword swing slash",               category: "weapon" },
  { event: "sword_clash",     filename: "sword_clash.mp3",      description: "Swords clashing / metal on metal",category: "weapon" },
  { event: "arrow_fire",      filename: "arrow_fire.mp3",       description: "Bow and arrow release",           category: "weapon" },

  // ── Impact / Body ──
  { event: "punch",           filename: "punch.mp3",            description: "Fist punch impact",               category: "impact" },
  { event: "kick",            filename: "kick.mp3",             description: "Body kick impact",                category: "impact" },
  { event: "body_fall",       filename: "body_fall.mp3",        description: "Body hitting the ground",         category: "impact" },
  { event: "glass_break",     filename: "glass_break.mp3",      description: "Glass shattering",                category: "impact" },
  { event: "explosion",       filename: "explosion.mp3",        description: "Explosion blast",                 category: "impact" },
  { event: "explosion_distant",filename: "explosion_distant.mp3",description: "Distant explosion rumble",      category: "impact" },

  // ── Nigerian Specific ──
  { event: "danfo_horn",      filename: "danfo_horn.mp3",       description: "Lagos danfo bus horn",            category: "nigerian" },
  { event: "agbero_shout",    filename: "agbero_shout.mp3",     description: "Agbero (tout) shouting",          category: "nigerian" },
  { event: "talking_drum",    filename: "talking_drum.mp3",     description: "Traditional talking drum beat",   category: "nigerian" },
  { event: "shekere",         filename: "shekere.mp3",          description: "Shekere shaker rhythm",           category: "nigerian" },
  { event: "naija_party",     filename: "naija_party.mp3",      description: "Nigerian party ambience",         category: "nigerian" },
  { event: "aso_ebi_crowd",   filename: "aso_ebi_crowd.mp3",    description: "Aso-ebi event celebration crowd", category: "nigerian" },
  { event: "owambe",          filename: "owambe.mp3",           description: "Owambe party celebration",        category: "nigerian" },

  // ── Household ──
  { event: "door_knock",      filename: "door_knock.mp3",       description: "Door knock (3 knocks)",           category: "household" },
  { event: "door_open",       filename: "door_open.mp3",        description: "Door opening creak",              category: "household" },
  { event: "door_close",      filename: "door_close.mp3",       description: "Door closing shut",               category: "household" },
  { event: "bell_ring",       filename: "bell_ring.mp3",        description: "Doorbell ring",                   category: "household" },
  { event: "phone_ring",      filename: "phone_ring.mp3",       description: "Phone ringing",                   category: "household" },
  { event: "notification",    filename: "notification.mp3",     description: "Phone notification sound",        category: "household" },
  { event: "water_pour",      filename: "water_pour.mp3",       description: "Water pouring into glass",        category: "household" },
  { event: "cooking",         filename: "cooking.mp3",          description: "Kitchen cooking / sizzle",        category: "household" },

  // ── Tech / Digital ──
  { event: "typing",          filename: "typing.mp3",           description: "Keyboard typing clicks",          category: "tech" },
  { event: "camera_shutter",  filename: "camera_shutter.mp3",   description: "Camera shutter click",            category: "tech" },
  { event: "ui_click",        filename: "ui_click.mp3",         description: "UI button click",                 category: "tech" },
  { event: "error_beep",      filename: "error_beep.mp3",       description: "Error / wrong answer beep",       category: "tech" },
  { event: "success_chime",   filename: "success_chime.mp3",    description: "Success / correct chime",         category: "tech" },
  { event: "countdown_tick",  filename: "countdown_tick.mp3",   description: "Clock tick countdown",            category: "tech" },

  // ── Music accents ──
  { event: "beat_drop",       filename: "beat_drop.mp3",        description: "Beat drop bass hit",              category: "music" },
  { event: "vinyl_scratch",   filename: "vinyl_scratch.mp3",    description: "DJ vinyl scratch",                category: "music" },
  { event: "airhorn",         filename: "airhorn.mp3",          description: "DJ airhorn blast",                category: "music" },
  { event: "cymbal_crash",    filename: "cymbal_crash.mp3",     description: "Cymbal crash accent",             category: "music" },
  { event: "drum_roll",       filename: "drum_roll.mp3",        description: "Drum roll buildup",               category: "music" },
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
