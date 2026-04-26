// POST /api/music-video/assemble
// Beat-sync music video assembly.
// Trims/loops each scene clip to match its song section duration, then
// concatenates all clips and overlays the full song from 0:00.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
export const maxDuration = 900;

interface Section {
  label: string;       // "intro" | "verse1" | "chorus" | "bridge" | "outro" etc.
  startSec: number;    // when section starts in the song
  durationSec: number; // how long the section is
}

interface MvScene {
  scene: number;
  videoUrl: string;        // /api/media/... or http URL to a generated scene clip
  sectionLabel?: string;   // which song section this scene covers
  targetDurationSec?: number; // override — exact seconds this clip should be in final video
  caption?: string;        // lyric/caption text to burn
}

interface MvAssembleRequest {
  projectId?: string;
  title?: string;
  songUrl?: string;           // URL or storage path to the song file
  songPath?: string;          // absolute or storage-relative path
  scenes: MvScene[];
  sections?: Section[];       // AI-generated section timing data
  musicVolume?: number;       // 0-1, default 0.85 (music is the star)
  narrationUrl?: string;      // optional voiceover to mix under music at 0.3 volume
  captions?: boolean;         // whether to burn captions
  captionStyle?: "white" | "yellow" | "neon";
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

function resolveMediaPath(url: string): string {
  if (url.startsWith("/api/media/")) {
    const rel = url.replace("/api/media/", "");
    return path.resolve(env.storagePath, rel.startsWith("storage/") ? rel.slice(8) : rel);
  }
  if (url.startsWith("http")) return url;
  if (url.startsWith("storage/")) return path.resolve(env.storagePath, url.slice(8));
  return url;
}

async function getVideoDuration(ffprobePath: string, filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v", "quiet", "-print_format", "json", "-show_streams", filePath,
    ], { timeout: 15000 });
    const info = JSON.parse(stdout);
    const vs = info.streams?.find((s: { codec_type: string; duration?: string }) => s.codec_type === "video");
    return vs?.duration ? parseFloat(vs.duration) : 5;
  } catch { return 5; }
}

export async function POST(req: NextRequest) {
  const body: MvAssembleRequest = await req.json();
  const { projectId, title, songUrl, songPath, scenes, sections, musicVolume = 0.85, narrationUrl, captions = false, captionStyle = "white", aspectRatio = "16:9" } = body;

  if (!scenes || scenes.length === 0) return NextResponse.json({ error: "No scenes provided" }, { status: 400 });

  const ffmpeg = env.ffmpegPath || "ffmpeg";
  const ffprobe = env.ffprobePath || "ffprobe";

  const outDir = path.join(env.storagePath, "video", "music-video");
  const tempDir = path.join(env.storagePath, "video", "temp", `mv_${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Build section-duration lookup
    const sectionMap: Record<string, number> = {};
    if (sections) {
      for (const sec of sections) sectionMap[sec.label.toLowerCase()] = sec.durationSec;
    }

    // Resolve each scene to a local trimmed/looped clip at target duration
    const segmentFiles: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const srcPath = resolveMediaPath(sc.videoUrl);

      // Determine target duration for this clip
      let targetDur: number;
      if (sc.targetDurationSec && sc.targetDurationSec > 0) {
        targetDur = sc.targetDurationSec;
      } else if (sc.sectionLabel && sectionMap[sc.sectionLabel.toLowerCase()]) {
        targetDur = sectionMap[sc.sectionLabel.toLowerCase()];
      } else {
        // Probe actual video duration
        const actualDur = srcPath.startsWith("http") ? 5 : await getVideoDuration(ffprobe, srcPath);
        targetDur = actualDur;
      }

      const segFile = path.join(tempDir, `seg_${i.toString().padStart(3, "0")}.mp4`);

      // Resolution based on aspect ratio
      const res = aspectRatio === "9:16" ? "1080x1920" : aspectRatio === "1:1" ? "1080x1080" : "1920x1080";

      // Caption filter
      let captionFilter = "";
      if (captions && sc.caption) {
        const safeText = sc.caption.replace(/'/g, "\\'").replace(/:/g, "\\:").slice(0, 80);
        const textColor = captionStyle === "yellow" ? "yellow" : captionStyle === "neon" ? "0x00ffff" : "white";
        const boxColor = captionStyle === "neon" ? "0x000000@0.6" : "black@0.5";
        captionFilter = `,drawtext=text='${safeText}':fontsize=36:fontcolor=${textColor}:box=1:boxcolor=${boxColor}:boxborderw=8:x=(w-text_w)/2:y=h-text_h-40`;
      }

      const scaleFilter = `scale=${res},setsar=1`;
      const vf = `${scaleFilter}${captionFilter}`;

      if (srcPath.startsWith("http")) {
        // For remote URLs — download first
        const tempSrc = path.join(tempDir, `raw_${i}.mp4`);
        const dlRes = await fetch(srcPath);
        if (!dlRes.ok) throw new Error(`Failed to download scene ${sc.scene} from ${srcPath}`);
        const buf = Buffer.from(await dlRes.arrayBuffer());
        fs.writeFileSync(tempSrc, buf);

        await execFileAsync(ffmpeg, [
          "-i", tempSrc,
          "-vf", vf, "-t", String(targetDur),
          "-c:v", "libx264", "-preset", "fast", "-crf", "23",
          "-an", "-y", segFile,
        ], { timeout: 120000 });
      } else {
        // Local file — trim/loop to targetDur using -stream_loop
        const actualDur = await getVideoDuration(ffprobe, srcPath);
        const loopNeeded = Math.ceil(targetDur / actualDur);

        await execFileAsync(ffmpeg, [
          "-stream_loop", String(loopNeeded - 1), "-i", srcPath,
          "-vf", vf, "-t", String(targetDur),
          "-c:v", "libx264", "-preset", "fast", "-crf", "23",
          "-an", "-y", segFile,
        ], { timeout: 120000 });
      }

      segmentFiles.push(segFile);
    }

    // Write concat list
    const concatList = path.join(tempDir, "concat.txt");
    fs.writeFileSync(concatList, segmentFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n"));

    // Concatenate all segments
    const concatFile = path.join(tempDir, "concat_raw.mp4");
    await execFileAsync(ffmpeg, [
      "-f", "concat", "-safe", "0", "-i", concatList,
      "-c", "copy", "-y", concatFile,
    ], { timeout: 300000 });

    // Resolve song path
    let resolvedSongPath = "";
    if (songPath) {
      resolvedSongPath = resolveMediaPath(songPath);
    } else if (songUrl) {
      if (songUrl.startsWith("http")) {
        const tempSong = path.join(tempDir, "song.mp3");
        const sRes = await fetch(songUrl);
        if (sRes.ok) {
          fs.writeFileSync(tempSong, Buffer.from(await sRes.arrayBuffer()));
          resolvedSongPath = tempSong;
        }
      } else {
        resolvedSongPath = resolveMediaPath(songUrl);
      }
    }

    // Build final output
    const safeTitle = (title || "music_video").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const outFile = path.join(outDir, `${safeTitle}_${Date.now()}.mp4`);

    // Resolve narration path if provided
    let resolvedNarrationPath = "";
    if (narrationUrl) {
      if (narrationUrl.startsWith("http")) {
        const tempNarr = path.join(tempDir, "narration.mp3");
        const nRes = await fetch(narrationUrl);
        if (nRes.ok) { fs.writeFileSync(tempNarr, Buffer.from(await nRes.arrayBuffer())); resolvedNarrationPath = tempNarr; }
      } else {
        resolvedNarrationPath = resolveMediaPath(narrationUrl);
      }
    }
    const hasNarration = resolvedNarrationPath && fs.existsSync(resolvedNarrationPath);

    if (resolvedSongPath && fs.existsSync(resolvedSongPath) && hasNarration) {
      // 3-stream mix: video + song (ducked) + narration (foreground)
      await execFileAsync(ffmpeg, [
        "-i", concatFile,
        "-i", resolvedSongPath,
        "-i", resolvedNarrationPath,
        "-filter_complex", `[1:a]volume=${musicVolume}[music];[2:a]volume=1.0[narr];[music][narr]amix=inputs=2:duration=first[aout]`,
        "-map", "0:v:0",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        "-y", outFile,
      ], { timeout: 300000 });
    } else if (resolvedSongPath && fs.existsSync(resolvedSongPath)) {
      // Mix video + song only
      await execFileAsync(ffmpeg, [
        "-i", concatFile,
        "-i", resolvedSongPath,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-filter:a", `volume=${musicVolume}`,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        "-y", outFile,
      ], { timeout: 300000 });
    } else if (hasNarration) {
      // Narration only, no music
      await execFileAsync(ffmpeg, [
        "-i", concatFile,
        "-i", resolvedNarrationPath,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        "-y", outFile,
      ], { timeout: 300000 });
    } else {
      // No audio — just video
      await execFileAsync(ffmpeg, [
        "-i", concatFile, "-c", "copy", "-y", outFile,
      ], { timeout: 60000 });
    }

    // Cleanup temp
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }

    const relativePath = path.relative(env.storagePath, outFile).replace(/\\/g, "/");
    const outputUrl = `/api/media/${relativePath}`;

    // Probe final duration
    let finalDuration = 0;
    try {
      const { stdout } = await execFileAsync(ffprobe, ["-v", "quiet", "-print_format", "json", "-show_streams", outFile], { timeout: 10000 });
      const info = JSON.parse(stdout);
      const vs = info.streams?.find((s: { codec_type: string; duration?: string }) => s.codec_type === "video");
      finalDuration = vs?.duration ? parseFloat(vs.duration) : 0;
    } catch { /* ignore */ }

    return NextResponse.json({
      ok: true,
      outputUrl,
      duration: finalDuration,
      scenes: scenes.length,
      title: title || "Music Video",
      projectId,
    });

  } catch (e) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Assembly failed" }, { status: 500 });
  }
}
