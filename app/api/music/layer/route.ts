// POST /api/music/layer — mix up to 3 audio tracks together
// DJ-style layering: per-track volume, master EQ, export as MP3/WAV
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

const trackSchema = z.object({
  path: z.string(),
  volume: z.number().min(0).max(2).default(1),
  pan: z.number().min(-1).max(1).default(0), // -1=left, 0=center, 1=right
});

const schema = z.object({
  tracks: z.array(trackSchema).min(1).max(3),
  masterVolume: z.number().min(0).max(2).default(1),
  eqBass: z.number().min(-10).max(10).default(0),    // dB
  eqMid: z.number().min(-10).max(10).default(0),
  eqTreble: z.number().min(-10).max(10).default(0),
  format: z.enum(["mp3", "wav"]).default("mp3"),
  durationSec: z.number().min(1).max(600).optional(), // trim output to this length
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tracks, masterVolume, eqBass, eqMid, eqTreble, format, durationSec } = parsed.data;

  // Validate all input files exist
  for (const t of tracks) {
    if (!fs.existsSync(t.path)) {
      return NextResponse.json({ error: `Track not found: ${t.path}` }, { status: 404 });
    }
  }

  const outputDir = path.join(env.storagePath, "music", "mixed");
  fs.mkdirSync(outputDir, { recursive: true });
  const ext = format === "wav" ? "wav" : "mp3";
  const outputPath = path.join(outputDir, `mix_${Date.now()}.${ext}`);

  const args: string[] = ["-y"];

  // Add all inputs
  for (const t of tracks) {
    args.push("-i", t.path);
  }

  // Build filter complex
  const filters: string[] = [];
  const mixLabels: string[] = [];

  tracks.forEach((t, i) => {
    const label = `[a${i}]`;
    const volFilter = t.volume !== 1 ? `volume=${t.volume}` : null;
    const panFilter = t.pan !== 0 ? `pan=stereo|FL<FL*${1 - Math.max(0, t.pan)}+FR*0|FR<FR*${1 + Math.min(0, t.pan)}+FL*0` : null;
    const trackFilters = [volFilter, panFilter].filter(Boolean).join(",");

    if (trackFilters) {
      filters.push(`[${i}:a]${trackFilters}${label}`);
    } else {
      filters.push(`[${i}:a]anull${label}`);
    }
    mixLabels.push(label);
  });

  // Mix tracks
  if (tracks.length > 1) {
    filters.push(`${mixLabels.join("")}amix=inputs=${tracks.length}:duration=longest:normalize=0[mixed]`);
  } else {
    filters.push(`${mixLabels[0]}anull[mixed]`);
  }

  // Master volume + EQ
  const masterFilters: string[] = [];
  if (masterVolume !== 1) masterFilters.push(`volume=${masterVolume}`);
  if (eqBass !== 0 || eqMid !== 0 || eqTreble !== 0) {
    masterFilters.push(`equalizer=f=100:t=h:w=200:g=${eqBass},equalizer=f=1000:t=h:w=1000:g=${eqMid},equalizer=f=8000:t=h:w=4000:g=${eqTreble}`);
  }

  if (masterFilters.length > 0) {
    filters.push(`[mixed]${masterFilters.join(",")}[master]`);
    args.push("-filter_complex", filters.join(";"), "-map", "[master]");
  } else {
    args.push("-filter_complex", filters.join(";"), "-map", "[mixed]");
  }

  // Duration cap
  if (durationSec) args.push("-t", String(durationSec));

  // Output format
  if (format === "wav") {
    args.push("-c:a", "pcm_s16le", outputPath);
  } else {
    args.push("-c:a", "libmp3lame", "-b:a", "192k", outputPath);
  }

  try {
    await execFileAsync(env.ffmpegPath, args, { timeout: 60000 });
    const stat = fs.statSync(outputPath);
    return NextResponse.json({ outputPath, format, size: stat.size });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Mix failed" }, { status: 500 });
  }
}
