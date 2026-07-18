// POST /api/editor/cut
// REMOVES [startSec,endSec] from a video and joins what's left — the opposite of
// /api/editor/trim (which KEEPS [start,end]). Henry: "I want to cut the middle out,
// not keep a range" (2026-07-18).
// Body: { videoUrl, startSec, endSec }
// Returns: { ok, outputUrl } or { error }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { resolveVideoPath } from "@/lib/resolve-video-path";

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

    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }

    const dur = await probeDuration(inputPath);
    if (!dur) {
      return NextResponse.json({ error: "Could not read video duration" }, { status: 500 });
    }
    if (startSec < 0 || endSec > dur) {
      return NextResponse.json({ error: `startSec/endSec out of range (video is ${dur.toFixed(2)}s)` }, { status: 400 });
    }

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `cut_${Date.now()}.mp4`;
    const outPath = path.join(outDir, outName);

    // Edge cases: removing the very head or the very tail keeps one range.
    // MUST re-encode (not -c copy): AI clips (e.g. Kling) often have a single
    // keyframe for the whole clip, so a stream-copy cut that doesn't start on a
    // keyframe plays back FROZEN in the browser (audio fine, picture stiff).
    // Re-encoding forces a fresh keyframe at the start. (Henry 2026-07-18.)
    const ENC = ["-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"];
    if (startSec <= 0.05) {
      // Cutting off the head → keep [end, dur]
      await runFFmpeg(["-ss", String(endSec), "-i", inputPath, ...ENC, "-y", outPath]);
    } else if (endSec >= dur - 0.05) {
      // Cutting off the tail → keep [0, start]
      await runFFmpeg(["-i", inputPath, "-t", String(startSec), ...ENC, "-y", outPath]);
    } else {
      // Cutting a MIDDLE section out → trim the two kept pieces and concat them
      // with a filter (re-encode required — stream copy can't join arbitrary cuts).
      const hasAudio = await probeHasAudio(inputPath);
      const args: string[] = ["-i", inputPath];
      let filter: string;
      if (hasAudio) {
        filter =
          `[0:v]trim=start=0:end=${startSec},setpts=PTS-STARTPTS[v0];` +
          `[0:a]atrim=start=0:end=${startSec},asetpts=PTS-STARTPTS[a0];` +
          `[0:v]trim=start=${endSec},setpts=PTS-STARTPTS[v1];` +
          `[0:a]atrim=start=${endSec},asetpts=PTS-STARTPTS[a1];` +
          `[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`;
        args.push(
          "-filter_complex", filter,
          "-map", "[outv]", "-map", "[outa]",
          "-c:v", "libx264", "-crf", "20", "-preset", "veryfast",
          "-c:a", "aac",
          "-movflags", "+faststart",
          "-y", outPath
        );
      } else {
        filter =
          `[0:v]trim=start=0:end=${startSec},setpts=PTS-STARTPTS[v0];` +
          `[0:v]trim=start=${endSec},setpts=PTS-STARTPTS[v1];` +
          `[v0][v1]concat=n=2:v=1:a=0[outv]`;
        args.push(
          "-filter_complex", filter,
          "-map", "[outv]",
          "-c:v", "libx264", "-crf", "20", "-preset", "veryfast",
          "-movflags", "+faststart",
          "-y", outPath
        );
      }
      await runFFmpeg(args);
    }

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
  } catch (err) {
    console.error("[editor/cut]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => resolve(parseFloat(out.trim()) || 0));
    proc.on("error", () => resolve(0));
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
