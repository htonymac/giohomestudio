// POST /api/editor/add-intro
// Prepends a text-on-black intro card to a video using FFmpeg
// Body: { videoUrl, text, duration }
// Returns: { ok, outputUrl }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, text, duration = 3 } = await req.json() as {
      videoUrl?: string;
      text?: string;
      duration?: number;
    };

    if (!videoUrl || !text?.trim()) {
      return NextResponse.json({ error: "videoUrl and text required" }, { status: 400 });
    }

    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }

    // Detect video size from ffprobe or default to 1920x1080
    const { width, height } = await probeVideoSize(inputPath);
    const w = width || 1920;
    const h = height || 1080;

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });

    const introPath = path.join(outDir, `intro_card_${Date.now()}.mp4`);
    const outPath = path.join(outDir, `intro_${Date.now()}.mp4`);
    const listPath = path.join(outDir, `concat_intro_${Date.now()}.txt`);

    // Generate intro card: black background + white centered text
    const safeText = text.replace(/['"\\:]/g, " ").slice(0, 80);
    await runFFmpeg([
      "-f", "lavfi",
      "-i", `color=c=black:s=${w}x${h}:d=${duration}:r=24`,
      "-vf", `drawtext=text='${safeText}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-an",
      "-y", introPath,
    ]);

    // Create concat list
    fs.writeFileSync(listPath, `file '${introPath.replace(/\\/g, "/")}'\nfile '${inputPath.replace(/\\/g, "/")}'\n`);

    // Concat intro + main video
    await runFFmpeg([
      "-f", "concat", "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      "-y", outPath,
    ]);

    // Cleanup temp files
    try { fs.unlinkSync(introPath); fs.unlinkSync(listPath); } catch { /* ignore */ }

    const outName = path.basename(outPath);
    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
  } catch (err) {
    console.error("[editor/add-intro]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function resolveVideoPath(videoUrl: string): string | null {
  const mediaMatch = videoUrl.match(/\/api\/media\/(.+)$/);
  if (mediaMatch) return path.resolve(env.storagePath, mediaMatch[1].replace(/\//g, path.sep));
  if (path.isAbsolute(videoUrl)) return videoUrl;
  return null;
}

async function probeVideoSize(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", filePath]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const parts = out.trim().split(",");
      resolve({ width: parseInt(parts[0]) || 0, height: parseInt(parts[1]) || 0 });
    });
    proc.on("error", () => resolve({ width: 0, height: 0 }));
  });
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
