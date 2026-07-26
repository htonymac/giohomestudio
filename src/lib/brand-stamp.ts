// Brand-logo stamp — overlays a logo image onto a video in one corner.
// The inverse of /api/editor/dewatermark: instead of hiding someone else's
// watermark, this burns in the USER's own logo. Used by /api/editor/stamp-logo
// (video-editor) and the commercial render (see brain ghs/video-editor decision).
//
// Scoped to video-editor + commercial for now; a future refactor centralises all
// ffmpeg behind one wrapper so this can run on every render path in one line
// (brain ghs/architecture "FUTURE: centralize ffmpeg").

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export type StampCorner = "br" | "bl" | "tr" | "tl" | "center";

export interface StampOpts {
  corner?: StampCorner;
  scale?: number;   // logo width as a fraction of the video width (0.03–0.6)
  opacity?: number; // 0.05–1
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// overlay x:y expressions — W,H = main video, w,h = scaled logo. Margin is 3% of
// the frame edge so the logo sits off the border on any resolution.
const POS: Record<StampCorner, string> = {
  tl: `(W*0.03):(H*0.03)`,
  tr: `W-w-(W*0.03):(H*0.03)`,
  bl: `(W*0.03):H-h-(H*0.03)`,
  br: `W-w-(W*0.03):H-h-(H*0.03)`,
  center: `(W-w)/2:(H-h)/2`,
};

// Overlays logoAbsPath onto inputAbsPath; returns the absolute output path.
// Re-encodes (same reason as the editor cut/trim/dewatermark ops — a single-
// keyframe source stream-copied plays frozen).
export async function stampLogoOnVideo(
  inputAbsPath: string,
  logoAbsPath: string,
  opts: StampOpts = {},
): Promise<string> {
  const scale = clamp(opts.scale ?? 0.15, 0.03, 0.6);
  const opacity = clamp(opts.opacity ?? 0.85, 0.05, 1);
  const pos = POS[opts.corner ?? "br"] ?? POS.br;

  const outDir = path.resolve(env.storagePath, "video");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `stamped_${Date.now()}.mp4`);

  const filter =
    `[1:v]format=rgba,colorchannelmixer=aa=${opacity},scale=iw*${scale}:-1[wm];` +
    `[0:v][wm]overlay=${pos}[out]`;

  await runFFmpeg([
    "-i", inputAbsPath,
    "-i", logoAbsPath,
    "-filter_complex", filter,
    "-map", "[out]", "-map", "0:a?",
    "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-movflags", "+faststart",
    "-y", outPath,
  ]);
  return outPath;
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  });
}
