// POST /api/music/generate — AI music generation
// When Suno/Mubert API is configured, generates original music.
// Fallback: picks best-matching stock track by mood/genre.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const schema = z.object({
  description: z.string().min(1).max(500),  // "Afrobeats energy, upbeat, 60 seconds"
  genre: z.string().max(50).optional(),
  mood: z.string().max(50).optional(),
  durationSeconds: z.number().min(5).max(300).optional(),
});

// Mood → stock track mapping
const MOOD_MAP: Record<string, string[]> = {
  epic:       ["epic.mp3", "epic_cinematic.mp3", "epic_orchestral.mp3"],
  calm:       ["calm.mp3", "calm_ambient.mp3"],
  emotional:  ["emotional.mp3", "emotional_piano.mp3"],
  dramatic:   ["dramatic.mp3", "dramatic_orchestral.mp3"],
  upbeat:     ["upbeat.mp3", "upbeat_pop.mp3", "dance.mp3"],
  action:     ["action.mp3", "war.mp3"],
  suspense:   ["suspense.mp3"],
  nature:     ["nature.mp3", "rain.mp3", "heavy_rain.mp3"],
};

function findBestTrack(description: string, mood?: string, genre?: string): string | null {
  const stockDir = path.resolve(env.storagePath, "music", "stock");
  if (!fs.existsSync(stockDir)) return null;

  const text = `${description} ${mood ?? ""} ${genre ?? ""}`.toLowerCase();

  // Try mood map first
  for (const [key, files] of Object.entries(MOOD_MAP)) {
    if (text.includes(key)) {
      for (const f of files) {
        const p = path.join(stockDir, f);
        if (fs.existsSync(p)) return p;
      }
    }
  }

  // Fallback: pick any stock file
  const all = fs.readdirSync(stockDir).filter(f => f.endsWith(".mp3"));
  if (all.length > 0) return path.join(stockDir, all[Math.floor(Math.random() * all.length)]);
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { description, mood, genre, durationSeconds } = parsed.data;

  // TODO: When SUNO_API_KEY or MUBERT_API_KEY is set, generate original music
  // For now, use stock library matching
  const trackPath = findBestTrack(description, mood, genre);

  if (!trackPath) {
    return NextResponse.json({ error: "No matching music found. Add stock tracks to storage/music/stock/" }, { status: 404 });
  }

  return NextResponse.json({
    musicPath: trackPath,
    source: "stock_match",
    description: `Matched from stock library based on: ${description}`,
    provider: "stock_library",
    note: "AI music generation (Suno/Mubert) coming soon. Currently using best stock match.",
  });
}
