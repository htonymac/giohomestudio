// POST /api/audio/stretch — Time-stretch audio without pitch change
// Uses FFmpeg atempo filter (range 0.5x to 2.0x)
// Input: { audioUrl, factor } where factor is 0.5 (slower) to 2.0 (faster)
// Output: { audioUrl, duration, factor }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function resolveMediaPath(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/media\/(.+)/);
  if (match) return path.join(env.storagePath, match[1].replace(/\//g, path.sep));
  if (fs.existsSync(url)) return url;
  const sp = path.join(env.storagePath, url);
  if (fs.existsSync(sp)) return sp;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audioUrl, factor } = body;

    if (!audioUrl) return NextResponse.json({ error: "audioUrl required" }, { status: 400 });

    const speed = Math.max(0.5, Math.min(2.0, parseFloat(factor) || 1.0));
    if (speed === 1.0) {
      return NextResponse.json({ audioUrl, duration: null, factor: 1.0, message: "No change (1.0x)" });
    }

    const inputPath = resolveMediaPath(audioUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
    }

    const outDir = path.join(env.storagePath, "audio", "stretched");
    fs.mkdirSync(outDir, { recursive: true });
    const ext = path.extname(inputPath) || ".mp3";
    const outFile = path.join(outDir, `stretched_${speed}x_${Date.now()}${ext}`);

    // FFmpeg atempo filter: supports 0.5 to 2.0
    // For values outside range, chain multiple atempo filters
    const atempoFilters: string[] = [];
    let remaining = speed;
    while (remaining > 2.0) { atempoFilters.push("atempo=2.0"); remaining /= 2.0; }
    while (remaining < 0.5) { atempoFilters.push("atempo=0.5"); remaining /= 0.5; }
    atempoFilters.push(`atempo=${remaining.toFixed(4)}`);

    await execFileAsync(env.ffmpegPath, [
      "-i", inputPath,
      "-filter:a", atempoFilters.join(","),
      "-y", outFile,
    ], { timeout: 60000 });

    if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 100) {
      return NextResponse.json({ error: "Stretch failed — output file empty" }, { status: 500 });
    }

    // Get duration via ffprobe
    let duration: number | null = null;
    try {
      const { stdout } = await execFileAsync(env.ffprobePath, [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", outFile,
      ], { timeout: 10000 });
      duration = parseFloat(stdout.trim()) || null;
    } catch { /* best effort */ }

    const url = `/api/media/audio/stretched/${path.basename(outFile)}`;
    return NextResponse.json({ audioUrl: url, duration, factor: speed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Stretch failed" }, { status: 500 });
  }
}
