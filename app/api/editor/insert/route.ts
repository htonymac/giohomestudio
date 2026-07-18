// POST /api/editor/insert
// Inserts a clip OR image into the MIDDLE of a video at atSec — splits the main
// video into A=[0,atSec] and B=[atSec,dur], normalizes the inserted media to the
// main video's WxH/fps (+ silent audio bed when needed), and concats A + media + B.
// atSec near 0 → media is prepended; atSec near the end → media is appended.
// Body: { videoUrl, atSec, mediaUrl, isImage?, duration? }
// Returns: { ok, outputUrl } or { error }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { resolveVideoPath } from "@/lib/resolve-video-path";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, atSec: atSecRaw, mediaUrl, isImage, duration } = await req.json() as {
      videoUrl?: string;
      atSec?: number;
      mediaUrl?: string;
      isImage?: boolean;
      duration?: number;
    };

    if (!videoUrl || atSecRaw == null || !Number.isFinite(atSecRaw) || !mediaUrl) {
      return NextResponse.json({ error: "videoUrl, atSec, mediaUrl required" }, { status: 400 });
    }

    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }
    const mediaPath = resolveVideoPath(mediaUrl);
    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return NextResponse.json({ error: `Media file not found: ${mediaUrl}` }, { status: 404 });
    }

    const { width, height } = await probeVideoSize(inputPath);
    const w = width || 1920;
    const h = height || 1080;
    const dur = await probeDuration(inputPath);
    if (!dur) {
      return NextResponse.json({ error: "Could not read video duration" }, { status: 500 });
    }
    const atSec = Math.max(0, Math.min(dur, atSecRaw));

    const mainHasAudio = await probeHasAudio(inputPath);

    // Image → looped for `duration` seconds, silent (images never carry audio).
    // Video clip → probe its own duration + whether it carries audio.
    let mediaDuration: number;
    let mediaHasAudio: boolean;
    if (isImage) {
      mediaDuration = Math.min(15, Math.max(1, Number(duration) || 3));
      mediaHasAudio = false;
    } else {
      mediaDuration = await probeDuration(mediaPath);
      if (!mediaDuration) {
        return NextResponse.json({ error: "Could not read inserted clip's duration" }, { status: 500 });
      }
      mediaHasAudio = await probeHasAudio(mediaPath);
    }

    // Only produce an audio track in the output if EITHER side actually has audio.
    // If audio presence differs between main/media, the side lacking it gets a
    // silent anullsrc bed so every concat branch has a matching v+a pair.
    const outputHasAudio = mainHasAudio || mediaHasAudio;

    const prepend = atSec <= 0.05;
    const append = atSec >= dur - 0.05;

    type Seg = { kind: "main"; start: number; end: number } | { kind: "media" };
    const segments: Seg[] = prepend
      ? [{ kind: "media" }, { kind: "main", start: 0, end: dur }]
      : append
        ? [{ kind: "main", start: 0, end: dur }, { kind: "media" }]
        : [{ kind: "main", start: 0, end: atSec }, { kind: "media" }, { kind: "main", start: atSec, end: dur }];

    // Same normalize expression as add-outro — forces every video segment to the
    // SAME resolution/fps/pixel format so concat never sees a mismatch, no matter
    // what aspect ratio/fps/codec the inserted clip or image was.
    const normV = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;

    // ── Build ffmpeg inputs ──
    // Index 0 = main video. Index 1 = media (image loop or clip). Any silent
    // anullsrc beds are appended after, in the exact order they're referenced below.
    const args: string[] = ["-i", inputPath];
    if (isImage) {
      args.push("-loop", "1", "-t", String(mediaDuration), "-i", mediaPath);
    } else {
      args.push("-i", mediaPath);
    }
    const mediaInputIdx = 1;
    let nextInputIdx = 2;

    let mediaSilentIdx: number | null = null;
    if (outputHasAudio && !mediaHasAudio) {
      args.push("-f", "lavfi", "-t", String(mediaDuration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
      mediaSilentIdx = nextInputIdx++;
    }

    // One silent bed PER main-video segment, only needed when the main track has
    // no audio of its own but the media does (so the output still needs audio).
    const mainSegSilentIdx: (number | null)[] = segments.map(() => null);
    if (outputHasAudio && !mainHasAudio) {
      segments.forEach((seg, i) => {
        if (seg.kind === "main") {
          const segDur = Math.max(0.05, seg.end - seg.start);
          args.push("-f", "lavfi", "-t", String(segDur), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
          mainSegSilentIdx[i] = nextInputIdx++;
        }
      });
    }

    // ── Build the filtergraph: one video (+ audio) node per segment, then concat ──
    const vFilters: string[] = [];
    const aFilters: string[] = [];
    const vLabels: string[] = [];
    const aLabels: string[] = [];

    segments.forEach((seg, i) => {
      if (seg.kind === "main") {
        vFilters.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS,${normV}[v${i}]`);
        vLabels.push(`[v${i}]`);
        if (outputHasAudio) {
          if (mainHasAudio) {
            aFilters.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
            aLabels.push(`[a${i}]`);
          } else {
            aLabels.push(`[${mainSegSilentIdx[i]}:a]`);
          }
        }
      } else {
        vFilters.push(`[${mediaInputIdx}:v]${normV}[v${i}]`);
        vLabels.push(`[v${i}]`);
        if (outputHasAudio) {
          if (mediaHasAudio) {
            aFilters.push(`[${mediaInputIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
            aLabels.push(`[a${i}]`);
          } else {
            aLabels.push(`[${mediaSilentIdx}:a]`);
          }
        }
      }
    });

    const concatInputs = outputHasAudio
      ? segments.map((_, i) => `${vLabels[i]}${aLabels[i]}`).join("")
      : vLabels.join("");
    const concatFilter = outputHasAudio
      ? `${concatInputs}concat=n=${segments.length}:v=1:a=1[outv][outa]`
      : `${concatInputs}concat=n=${segments.length}:v=1:a=0[outv]`;

    const filterComplex = [...vFilters, ...aFilters, concatFilter].join(";");

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `insert_${Date.now()}.mp4`;
    const outPath = path.join(outDir, outName);

    args.push("-filter_complex", filterComplex, "-map", "[outv]");
    if (outputHasAudio) args.push("-map", "[outa]");
    args.push("-c:v", "libx264", "-crf", "20", "-preset", "veryfast");
    if (outputHasAudio) args.push("-c:a", "aac");
    args.push("-movflags", "+faststart", "-y", outPath);

    await runFFmpeg(args);

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
  } catch (err) {
    console.error("[editor/insert]", err);
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
