// POST /api/editor/dewatermark
// Removes/covers a burned-in watermark (e.g. KlingAI's bottom-right logo) by
// blurring (delogo) or painting over (drawbox) a rectangular region of the frame.
// Body: { videoUrl, corner?: "br"|"bl"|"tr"|"tl", x?,y?,w?,h?: 0..1 fractions
//         (override corner), mode?: "blur"|"cover", coverColor?: string }
// Returns: { ok, outputUrl } or { error }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { resolveVideoPath } from "@/lib/resolve-video-path";

// Fractional (0..1) box presets, each covering the bottom/top 10% strip on the
// 40%-wide near side of the frame — big enough to fully cover typical
// bottom-right/bottom-left AI-generator watermark placements.
const CORNER_PRESETS: Record<string, { x: number; y: number; w: number; h: number }> = {
  br: { x: 0.60, y: 0.88, w: 0.40, h: 0.10 },
  bl: { x: 0.00, y: 0.88, w: 0.40, h: 0.10 },
  tr: { x: 0.60, y: 0.00, w: 0.40, h: 0.10 },
  tl: { x: 0.00, y: 0.00, w: 0.40, h: 0.10 },
};

// Named ffmpeg colors or #rrggbb(aa) hex only — blocks filtergraph injection
// via a crafted coverColor string.
const SAFE_COLOR = /^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|[a-zA-Z]+)$/;

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, corner, x, y, w, h, mode, coverColor } = await req.json() as {
      videoUrl?: string;
      corner?: string;
      x?: number; y?: number; w?: number; h?: number;
      mode?: string;
      coverColor?: string;
    };

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
    }

    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }

    const useMode = mode === "cover" ? "cover" : "blur";
    const color = coverColor || "black";
    if (useMode === "cover" && !SAFE_COLOR.test(color)) {
      return NextResponse.json({ error: `Invalid coverColor: ${color}` }, { status: 400 });
    }

    const { width, height } = await probeVideoSize(inputPath);
    const W = width || 1920;
    const H = height || 1080;

    // Fraction box: explicit x/y/w/h (all four) override the corner preset.
    const hasOverride = [x, y, w, h].every((v) => typeof v === "number" && Number.isFinite(v));
    const frac = hasOverride
      ? { x: x as number, y: y as number, w: w as number, h: h as number }
      : CORNER_PRESETS[corner || "br"] || CORNER_PRESETS.br;

    const { bx, by, bw, bh } = clampBox(frac.x * W, frac.y * H, frac.w * W, frac.h * H, W, H);

    const filter = useMode === "blur"
      ? `delogo=x=${bx}:y=${by}:w=${bw}:h=${bh}`
      : `drawbox=x=${bx}:y=${by}:w=${bw}:h=${bh}:color=${color}@1:t=fill`;

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `dewatermark_${Date.now()}.mp4`;
    const outPath = path.join(outDir, outName);

    // Re-encode (not -c copy): AI clips (e.g. Kling) often have a single keyframe
    // for the whole clip, so a stream-copy pass that doesn't start on a keyframe
    // plays back FROZEN in the browser (audio fine, picture stiff). Re-encoding
    // forces a fresh keyframe at the start. (Same rule as cut/trim/insert.)
    await runFFmpeg([
      "-i", inputPath,
      "-vf", filter,
      "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-movflags", "+faststart",
      "-y", outPath,
    ]);

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
  } catch (err) {
    console.error("[editor/dewatermark]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Turns a fractional box (possibly overshooting the frame edge, possibly
// odd-sized) into pixel coordinates that are guaranteed to sit strictly
// inside [0,W)x[0,H) with even x/y/w/h — delogo/drawbox need w,h >= ~2 and a
// box that never runs past the frame edge, and even coords keep chroma
// (yuv420p) planes aligned.
function clampBox(x: number, y: number, w: number, h: number, W: number, H: number) {
  let bx = Math.max(0, Math.min(Math.round(x), W - 2));
  let by = Math.max(0, Math.min(Math.round(y), H - 2));
  let bw = Math.max(2, Math.min(Math.round(w), W - bx));
  let bh = Math.max(2, Math.min(Math.round(h), H - by));
  bx -= bx % 2;
  by -= by % 2;
  bw -= bw % 2;
  bh -= bh % 2;
  bw = Math.max(2, Math.min(bw, W - bx));
  bh = Math.max(2, Math.min(bh, H - by));
  return { bx, by, bw, bh };
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
