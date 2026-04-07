// POST /api/music/trim — trim audio to exact start/end, with optional fade in/out
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

const schema = z.object({
  inputPath: z.string(),
  startSec: z.number().min(0),
  endSec: z.number().min(0.1),
  fadeInSec: z.number().min(0).max(10).optional(),
  fadeOutSec: z.number().min(0).max(10).optional(),
  volume: z.number().min(0).max(2).optional(),
  loop: z.boolean().optional(),
  loopCount: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { inputPath, startSec, endSec, fadeInSec, fadeOutSec, volume, loop, loopCount } = parsed.data;
  if (!fs.existsSync(inputPath)) {
    return NextResponse.json({ error: "Input file not found" }, { status: 404 });
  }

  const duration = endSec - startSec;
  const outputDir = path.join(env.storagePath, "music", "trimmed");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `trim_${Date.now()}.mp3`);

  const filters: string[] = [];

  // Trim
  const args: string[] = ["-y", "-i", inputPath, "-ss", String(startSec), "-t", String(duration)];

  // Volume
  if (volume !== undefined && volume !== 1) {
    filters.push(`volume=${volume}`);
  }

  // Fade in
  if (fadeInSec && fadeInSec > 0) {
    filters.push(`afade=t=in:st=0:d=${fadeInSec}`);
  }

  // Fade out
  if (fadeOutSec && fadeOutSec > 0) {
    const fadeStart = duration - fadeOutSec;
    if (fadeStart > 0) filters.push(`afade=t=out:st=${fadeStart}:d=${fadeOutSec}`);
  }

  if (filters.length > 0) {
    args.push("-af", filters.join(","));
  }

  // Loop
  if (loop && loopCount && loopCount > 1) {
    args.push("-stream_loop", String(loopCount - 1));
  }

  args.push("-c:a", "libmp3lame", "-b:a", "128k", outputPath);

  try {
    await execFileAsync(env.ffmpegPath, args, { timeout: 30000 });

    // Auto-save to asset library
    try {
      const assetFile = path.join(env.storagePath, "config", "asset-library.json");
      let assets: Array<Record<string, unknown>> = [];
      try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
      const inputName = inputPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "trimmed";
      assets.unshift({
        id: `asset_trim_${Date.now()}`,
        type: "music",
        name: `${inputName} (${startSec}s-${endSec}s)`,
        description: `Trimmed from ${inputName}, ${duration}s with fade`,
        filePath: outputPath,
        tags: ["trimmed", "music", "dj"],
        source: "dj_trim",
        createdAt: new Date().toISOString(),
      });
      fs.mkdirSync(path.dirname(assetFile), { recursive: true });
      fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
    } catch { /* best effort */ }

    return NextResponse.json({ outputPath, duration });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Trim failed" }, { status: 500 });
  }
}
