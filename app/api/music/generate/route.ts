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

  // Try Suno API if configured
  const sunoKey = process.env.SUNO_API_KEY;
  if (sunoKey) {
    try {
      const axios = (await import("axios")).default;
      const res = await axios.post("https://api.suno.com/v1/generate", {
        prompt: description,
        duration: durationSeconds ?? 30,
        genre: genre ?? "cinematic",
      }, {
        headers: { Authorization: `Bearer ${sunoKey}`, "Content-Type": "application/json" },
        timeout: 120000,
      });

      if (res.data?.audio_url) {
        const audioRes = await axios.get(res.data.audio_url, { responseType: "arraybuffer", timeout: 60000 });
        const outDir = path.join(env.storagePath, "music", "generated");
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `suno_${Date.now()}.mp3`);
        fs.writeFileSync(outPath, Buffer.from(audioRes.data));

        // Auto-save to asset library
        try {
          const assetFile = path.join(env.storagePath, "config", "asset-library.json");
          let assets: Array<Record<string, unknown>> = [];
          try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
          assets.unshift({
            id: `music_ai_${Date.now()}`,
            type: "music",
            name: description.slice(0, 50),
            description: `AI-generated music: ${description}`,
            filePath: outPath,
            tags: ["music", "ai-generated", "suno"],
            source: "suno_ai",
            createdAt: new Date().toISOString(),
          });
          fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
        } catch { /* best effort */ }

        return NextResponse.json({
          musicPath: outPath,
          source: "suno_ai",
          description: `AI-generated: ${description}`,
          provider: "suno",
        });
      }
    } catch (err) {
      console.warn(`[Music] Suno generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Try Mubert API if configured
  const mubertKey = process.env.MUBERT_API_KEY;
  if (mubertKey) {
    try {
      const axios = (await import("axios")).default;
      const res = await axios.post("https://api.mubert.com/v2/RecordTrackTTM", {
        params: {
          pat: mubertKey,
          duration: durationSeconds ?? 30,
          tags: [mood ?? "cinematic", genre ?? "background"].filter(Boolean),
          mode: "track",
        },
      }, { timeout: 120000 });

      if (res.data?.data?.tasks?.[0]?.download_link) {
        const url = res.data.data.tasks[0].download_link;
        const audioRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
        const outDir = path.join(env.storagePath, "music", "generated");
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `mubert_${Date.now()}.mp3`);
        fs.writeFileSync(outPath, Buffer.from(audioRes.data));

        return NextResponse.json({
          musicPath: outPath,
          source: "mubert_ai",
          description: `AI-generated: ${description}`,
          provider: "mubert",
        });
      }
    } catch (err) {
      console.warn(`[Music] Mubert generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fallback: stock library matching
  const trackPath = findBestTrack(description, mood, genre);

  if (!trackPath) {
    return NextResponse.json({ error: "No matching music found. Configure SUNO_API_KEY or MUBERT_API_KEY for AI generation, or add stock tracks." }, { status: 404 });
  }

  return NextResponse.json({
    musicPath: trackPath,
    source: "stock_match",
    description: `Matched from stock library: ${description}`,
    provider: "stock_library",
    note: sunoKey || mubertKey ? "AI generation failed — using stock match" : "Set SUNO_API_KEY or MUBERT_API_KEY in Settings for AI music generation",
  });
}
