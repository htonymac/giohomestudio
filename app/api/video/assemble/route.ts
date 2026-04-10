// POST /api/video/assemble — Final movie assembly
// Merges rendered scene videos + audio (music, narration, SFX) into one video
// Uses FFmpeg for concatenation, audio mixing, and transitions
// Returns: { outputUrl, duration, scenes } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface AssemblyScene {
  scene: number;
  videoUrl: string;      // /api/media/... path to rendered scene video
  audioUrl?: string;     // optional per-scene audio
  duration?: number;     // seconds
}

interface AssemblyRequest {
  projectId?: string;
  title?: string;
  scenes: AssemblyScene[];
  musicUrl?: string;     // background music track URL
  narrationUrl?: string; // narration voiceover URL
  musicVolume?: number;  // 0-1, default 0.3
  outputFormat?: "mp4" | "webm";
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

export async function POST(req: NextRequest) {
  try {
    const body: AssemblyRequest = await req.json();

    if (!body.scenes?.length) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const outDir = path.join(env.storagePath, "video", "assembled");
    fs.mkdirSync(outDir, { recursive: true });

    const tempDir = path.join(env.storagePath, "video", "temp", `assembly_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const ffmpeg = env.ffmpegPath;

    // ── Step 1: Download all scene videos to temp ──
    const sceneFiles: string[] = [];
    for (const scene of body.scenes) {
      const videoPath = resolveMediaPath(scene.videoUrl);
      if (!videoPath || !fs.existsSync(videoPath)) {
        return NextResponse.json({ error: `Scene ${scene.scene} video not found: ${scene.videoUrl}` }, { status: 404 });
      }
      sceneFiles.push(videoPath);
    }

    // ── Step 2: Create concat file for FFmpeg ──
    const concatFile = path.join(tempDir, "concat.txt");
    const concatContent = sceneFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(concatFile, concatContent);

    // ── Step 3: Concatenate all scene videos ──
    const concatOutput = path.join(tempDir, "concat_raw.mp4");
    try {
      await execFileAsync(ffmpeg, [
        "-f", "concat", "-safe", "0",
        "-i", concatFile,
        "-c", "copy",
        "-movflags", "+faststart",
        concatOutput,
      ], { timeout: 300000 });
    } catch (e) {
      // If copy fails (different codecs), re-encode
      try {
        await execFileAsync(ffmpeg, [
          "-f", "concat", "-safe", "0",
          "-i", concatFile,
          "-c:v", "libx264", "-preset", "fast", "-crf", "23",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart",
          "-y", concatOutput,
        ], { timeout: 600000 });
      } catch (e2) {
        cleanTemp(tempDir);
        return NextResponse.json({ error: `FFmpeg concat failed: ${e2 instanceof Error ? e2.message : String(e2)}` }, { status: 500 });
      }
    }

    // ── Step 4: Mix in background music if provided ──
    let finalPath = concatOutput;

    if (body.musicUrl) {
      const musicPath = resolveMediaPath(body.musicUrl);
      if (musicPath && fs.existsSync(musicPath)) {
        const mixedOutput = path.join(tempDir, "with_music.mp4");
        const musicVol = body.musicVolume ?? 0.3;

        try {
          await execFileAsync(ffmpeg, [
            "-i", concatOutput,
            "-i", musicPath,
            "-filter_complex", `[0:a]volume=1[va];[1:a]volume=${musicVol}[ma];[va][ma]amix=inputs=2:duration=first[out]`,
            "-map", "0:v",
            "-map", "[out]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            "-y", mixedOutput,
          ], { timeout: 300000 });
          finalPath = mixedOutput;
        } catch {
          // If video has no audio stream, just add music directly
          try {
            await execFileAsync(ffmpeg, [
              "-i", concatOutput,
              "-i", musicPath,
              "-map", "0:v",
              "-map", "1:a",
              "-c:v", "copy",
              "-c:a", "aac", "-b:a", "192k",
              "-shortest",
              "-movflags", "+faststart",
              "-y", mixedOutput,
            ], { timeout: 300000 });
            finalPath = mixedOutput;
          } catch { /* keep concat without music */ }
        }
      }
    }

    // ── Step 5: Add narration overlay if provided ──
    if (body.narrationUrl) {
      const narrationPath = resolveMediaPath(body.narrationUrl);
      if (narrationPath && fs.existsSync(narrationPath)) {
        const narrationOutput = path.join(tempDir, "with_narration.mp4");
        try {
          await execFileAsync(ffmpeg, [
            "-i", finalPath,
            "-i", narrationPath,
            "-filter_complex", `[0:a]volume=0.7[va];[1:a]volume=1[na];[va][na]amix=inputs=2:duration=first[out]`,
            "-map", "0:v",
            "-map", "[out]",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            "-y", narrationOutput,
          ], { timeout: 300000 });
          finalPath = narrationOutput;
        } catch { /* keep without narration */ }
      }
    }

    // ── Step 6: Copy final to output directory ──
    const finalFilename = `movie_${body.projectId ?? "export"}_${Date.now()}.mp4`;
    const outputPath = path.join(outDir, finalFilename);
    fs.copyFileSync(finalPath, outputPath);

    // ── Step 7: Get duration with ffprobe ──
    let totalDuration = 0;
    try {
      const { stdout } = await execFileAsync(env.ffprobePath, [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath,
      ]);
      totalDuration = parseFloat(stdout.trim()) || 0;
    } catch { /* ignore */ }

    // ── Step 8: Auto-save to asset library ──
    try {
      const assetFile = path.join(env.storagePath, "config", "asset-library.json");
      let assets: Array<Record<string, unknown>> = [];
      try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
      assets.unshift({
        id: `movie_${Date.now()}`, type: "video",
        name: body.title ? `Movie: ${body.title}` : `Assembled Movie`,
        description: `${body.scenes.length} scenes, ${Math.round(totalDuration)}s`,
        filePath: outputPath, tags: ["movie", "assembled", "final"],
        source: "movie_planner", createdAt: new Date().toISOString(),
      });
      fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
    } catch { /* best effort */ }

    // ── Step 9: Auto-generate thumbnail ──
    let thumbnailUrl: string | null = null;
    try {
      const thumbDir = path.join(env.storagePath, "thumbnails");
      fs.mkdirSync(thumbDir, { recursive: true });
      const thumbPath = path.join(thumbDir, `thumb_${Date.now()}.jpg`);
      // Grab frame at 30% of video duration (usually a good representative frame)
      const thumbTime = Math.max(1, Math.round(totalDuration * 0.3));
      await execFileAsync(env.ffmpegPath, [
        "-ss", String(thumbTime), "-i", outputPath,
        "-vframes", "1", "-vf", "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black",
        "-q:v", "2", "-y", thumbPath,
      ], { timeout: 10000 });
      const thumbRel = thumbPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
      thumbnailUrl = `/api/media/${thumbRel}`;
    } catch { /* thumbnail generation is best-effort */ }

    // ── Cleanup temp ──
    cleanTemp(tempDir);

    const relPath = outputPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
    return NextResponse.json({
      outputUrl: `/api/media/${relPath}`,
      thumbnailUrl,
      duration: totalDuration,
      scenes: body.scenes.length,
      title: body.title ?? "Assembled Movie",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

// ── Helpers ──

function resolveMediaPath(url: string): string | null {
  if (!url) return null;
  // Handle /api/media/... URLs → resolve to storage path
  const match = url.match(/\/api\/media\/(.+)/);
  if (match) {
    return path.join(env.storagePath, match[1].replace(/\//g, path.sep));
  }
  // Handle direct storage paths
  if (fs.existsSync(url)) return url;
  const storagePath = path.join(env.storagePath, url);
  if (fs.existsSync(storagePath)) return storagePath;
  return null;
}

function cleanTemp(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}
