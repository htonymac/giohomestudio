// POST /api/scene/prerender — render a 5-sec scene MP4 from an image with
// Ken Burns motion + fade. Caches by hash(imageUrl + duration + motion) so
// re-requests are free.
//
// This is Option B from Henry's 2026-06-01 speed plan: pre-render scenes
// when the image lands. Then /api/video/assemble takes the pre-rendered MP4
// as a normal video URL (no `img:` prefix) and skips the heavy zoompan +
// scale per-scene work, going straight to subtitle overlay + audio mix.
//
// Body: { imageUrl: string, duration?: number (default 5), motion?: string }
// Response: { ok: true, videoUrl: string, cached: boolean, tookMs: number }

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import * as path from "path";
import * as fs from "fs";

const execFileAsync = promisify(execFile);

function urlToDiskPath(url: string): string | null {
  if (url.startsWith("/api/media/")) {
    return path.join(env.storagePath, url.slice("/api/media/".length));
  }
  return null;
}

const MOTION_STYLES = ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "zoom_rotate"];

function buildZoompan(motion: string, totalFrames: number, fps: number): string {
  switch (motion) {
    case "zoom_out":
      return `zoompan=z='if(eq(on,0),1.15,max(zoom-0.0015,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
    case "pan_left":
      return `zoompan=z='1.08':x='(iw-iw/zoom)*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
    case "pan_right":
      return `zoompan=z='1.08':x='(iw-iw/zoom)*(1-on/${totalFrames})':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
    case "pan_up":
      return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/${totalFrames})':d=${totalFrames}:s=1100x620:fps=${fps}`;
    case "zoom_rotate":
      return `zoompan=z='min(zoom+0.001,1.12)':x='iw/2-(iw/zoom/2)+sin(on/10)*20':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
    case "zoom_in":
    default:
      return `zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
  }
}

export async function POST(req: NextRequest) {
  const tStart = Date.now();
  try {
    const body = await req.json();
    const imageUrl = String(body.imageUrl || "").trim();
    const duration = Math.max(2, Math.min(30, Number(body.duration) || 5));
    const motion = MOTION_STYLES.includes(String(body.motion)) ? String(body.motion) : "zoom_in";

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    const imagePath = urlToDiskPath(imageUrl);
    if (!imagePath || !fs.existsSync(imagePath)) {
      return NextResponse.json({ error: `Image not found: ${imageUrl}` }, { status: 404 });
    }

    // Stable cache key
    const hash = createHash("sha1").update(`${imageUrl}|${duration}|${motion}`).digest("hex").slice(0, 16);
    const outDir = path.join(env.storagePath, "scenes", "prerendered");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${hash}.mp4`);
    const videoUrl = `/api/media/scenes/prerendered/${hash}.mp4`;

    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
      return NextResponse.json({
        ok: true, videoUrl, cached: true, tookMs: Date.now() - tStart,
      });
    }

    const fps = 25;
    const totalFrames = Math.round(duration * fps);
    const zoompan = buildZoompan(motion, totalFrames, fps);

    const vf = [
      `scale=1100:620:force_original_aspect_ratio=decrease,pad=1100:620:(ow-iw)/2:(oh-ih)/2:color=black`,
      `eq=brightness=0.06:contrast=1.12:saturation=1.1`,
      zoompan,
      `scale=1920:1080`,
      `fade=t=in:st=0:d=0.6,fade=t=out:st=${Math.max(duration - 0.6, 0.3)}:d=0.6`,
    ].join(",");

    const ffmpeg = env.ffmpegPath;
    await execFileAsync(ffmpeg, [
      "-y", "-loop", "1", "-i", imagePath,
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-vf", vf,
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
      "-c:a", "aac", "-b:a", "128k",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-t", String(duration),
      outFile,
    ], { timeout: 60000 });

    if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 1000) {
      return NextResponse.json({ error: "Pre-render produced empty file" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true, videoUrl, cached: false, tookMs: Date.now() - tStart,
    });
  } catch (err) {
    console.error("[scene/prerender] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "prerender failed", tookMs: Date.now() - tStart },
      { status: 500 }
    );
  }
}
