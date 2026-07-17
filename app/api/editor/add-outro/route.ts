// POST /api/editor/add-outro
// Appends an outro to a video using FFmpeg. Two modes:
//   - imageUrl present → append the product image (scaled/padded to the video) as
//     an N-second outro. Robust for ANY imported clip: normalises res/fps/sar and
//     handles videos with OR without an audio track (Henry 2026-07-16 product outro).
//   - text only → append a text-on-black card (legacy behaviour).
// Body: { videoUrl, imageUrl?, text?, duration? }
// Returns: { ok, outputUrl }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { resolveVideoPath } from "@/lib/resolve-video-path";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, imageUrl, text, duration = 3 } = await req.json() as {
      videoUrl?: string;
      imageUrl?: string;
      text?: string;
      duration?: number;
    };

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
    }
    if (!imageUrl && !text?.trim()) {
      return NextResponse.json({ error: "Provide imageUrl (product outro) or text (text card)" }, { status: 400 });
    }

    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }

    const { width, height } = await probeVideoSize(inputPath);
    const w = width || 1920;
    const h = height || 1080;
    const dur = Math.min(15, Math.max(1, Number(duration) || 3));

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `outro_${Date.now()}.mp4`;
    const outPath = path.join(outDir, outName);

    // ── Product-image outro: single-pass concat FILTER (re-encode) so it works on
    //    any imported codec/resolution, unlike the fragile demuxer -c copy path. ──
    if (imageUrl) {
      const imgPath = resolveVideoPath(imageUrl);
      if (!imgPath || !fs.existsSync(imgPath)) {
        return NextResponse.json({ error: `Outro image not found: ${imageUrl}` }, { status: 404 });
      }
      const hasAudio = await probeHasAudio(inputPath);
      const norm = (label: string) =>
        `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p${label}`;

      const args: string[] = [
        "-i", inputPath,
        "-loop", "1", "-t", String(dur), "-i", imgPath,
      ];
      let filter: string;
      if (hasAudio) {
        // silent audio bed for the image tail; concat video's real audio + silence
        args.push("-f", "lavfi", "-t", String(dur), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
        filter =
          `[0:v]${norm("[v0]")};[1:v]${norm("[v1]")};` +
          `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];` +
          `[v0][a0][v1][2:a]concat=n=2:v=1:a=1[outv][outa]`;
        args.push("-filter_complex", filter, "-map", "[outv]", "-map", "[outa]",
          "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "-y", outPath);
      } else {
        filter = `[0:v]${norm("[v0]")};[1:v]${norm("[v1]")};[v0][v1]concat=n=2:v=1:a=0[outv]`;
        args.push("-filter_complex", filter, "-map", "[outv]",
          "-c:v", "libx264", "-movflags", "+faststart", "-y", outPath);
      }
      await runFFmpeg(args);
      return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
    }

    // ── Legacy text-on-black card ──
    const outroPath = path.join(outDir, `outro_card_${Date.now()}.mp4`);
    const listPath = path.join(outDir, `concat_outro_${Date.now()}.txt`);
    const safeText = (text ?? "").replace(/['"\\:]/g, " ").slice(0, 80);
    await runFFmpeg([
      "-f", "lavfi",
      "-i", `color=c=black:s=${w}x${h}:d=${dur}:r=24`,
      "-vf", `drawtext=text='${safeText}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-an",
      "-y", outroPath,
    ]);
    fs.writeFileSync(listPath, `file '${inputPath.replace(/\\/g, "/")}'\nfile '${outroPath.replace(/\\/g, "/")}'\n`);
    await runFFmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-y", outPath]);
    try { fs.unlinkSync(outroPath); fs.unlinkSync(listPath); } catch { /* ignore */ }

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
  } catch (err) {
    console.error("[editor/add-outro]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
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

async function probeHasAudio(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "csv=p=0", filePath]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => resolve(out.trim().length > 0));
    proc.on("error", () => resolve(false));
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
