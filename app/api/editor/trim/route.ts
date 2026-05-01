// POST /api/editor/trim
// Trims a video to the specified start/end time range using FFmpeg
// Body: { videoUrl, startSec, endSec }
// Returns: { ok, outputUrl }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, startSec, endSec } = await req.json() as {
      videoUrl?: string;
      startSec?: number;
      endSec?: number;
    };

    if (!videoUrl || startSec == null || endSec == null) {
      return NextResponse.json({ error: "videoUrl, startSec, endSec required" }, { status: 400 });
    }
    if (endSec <= startSec) {
      return NextResponse.json({ error: "endSec must be greater than startSec" }, { status: 400 });
    }

    // Resolve local file path from URL
    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `trim_${Date.now()}.mp4`;
    const outPath = path.join(outDir, outName);

    await runFFmpeg([
      "-i", inputPath,
      "-ss", String(startSec),
      "-to", String(endSec),
      "-c", "copy",
      "-y",
      outPath,
    ]);

    const outputUrl = `/api/media/video/${outName}`;
    return NextResponse.json({ ok: true, outputUrl });
  } catch (err) {
    console.error("[editor/trim]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function resolveVideoPath(videoUrl: string): string | null {
  // If it's an /api/media/ URL, map to storage
  const mediaMatch = videoUrl.match(/\/api\/media\/(.+)$/);
  if (mediaMatch) {
    return path.resolve(env.storagePath, mediaMatch[1].replace(/\//g, path.sep));
  }
  // If it's already an absolute path
  if (path.isAbsolute(videoUrl)) return videoUrl;
  // Try storage root
  const storagePath = path.resolve(env.storagePath, videoUrl.replace(/^\//, ""));
  if (fs.existsSync(storagePath)) return storagePath;
  return null;
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  });
}
