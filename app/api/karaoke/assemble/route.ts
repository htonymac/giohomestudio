// POST /api/karaoke/assemble
// Body: { recordingId: string }
// FFmpeg combines voice + generated music + mixSettings ducking.
// Output: storage/karaoke/assembled/<recordingId>_<timestamp>.mp3
// Saves mixedOutputUrl on KaraokeRecording.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const TIMEOUT_MS = 120_000;

function runFFmpegMix(
  voicePath: string,
  musicPath: string,
  outputPath: string,
  voiceVolume: number,
  musicVolume: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Two-input amix: voice stays prominent, music ducks under
    const args = [
      "-y",
      "-i", voicePath,
      "-i", musicPath,
      "-filter_complex",
      `[0:a]volume=${voiceVolume}[v];[1:a]volume=${musicVolume}[m];[v][m]amix=inputs=2:duration=longest:dropout_transition=2[out]`,
      "-map", "[out]",
      "-c:a", "libmp3lame",
      "-q:a", "3",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`FFmpeg timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

function resolveFilePath(fileUrl: string): string {
  // General /api/media/<rel> → storagePath/<rel>. Was karaoke-only, which broke stock
  // music served from /api/media/music/stock/*.mp3 ("Cannot resolve path"). 2026-05-28
  const m = fileUrl.match(/\/api\/media\/(.+)/);
  if (m) return path.join(env.storagePath, m[1]);
  if (fileUrl.startsWith("/storage/") || fileUrl.startsWith("storage/")) {
    return path.join(env.storagePath, fileUrl.replace(/^\/?storage\//, ""));
  }
  if (path.isAbsolute(fileUrl)) return fileUrl;
  throw new Error(`Cannot resolve path from URL: ${fileUrl}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId } = body;

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    if (!recording.generatedMusicUrl) {
      return NextResponse.json(
        { error: "No generated music URL — run Music Generation (Step 10) first" },
        { status: 400 }
      );
    }

    // Resolve voice path
    const voicePath = resolveFilePath(recording.fileUrl);
    if (!fs.existsSync(voicePath)) {
      return NextResponse.json({ error: `Voice file not found: ${voicePath}` }, { status: 404 });
    }

    // Resolve music path (handles /api/media/music/stock/*.mp3, /storage/*, abs paths)
    const musicUrl = recording.generatedMusicUrl;
    let musicPath: string;
    try {
      musicPath = fs.existsSync(musicUrl) ? musicUrl : resolveFilePath(musicUrl);
    } catch {
      musicPath = path.join(env.storagePath, "music", path.basename(musicUrl));
    }
    if (!fs.existsSync(musicPath)) {
      // Fallback: search common stock locations by basename
      const base = path.basename(musicUrl);
      for (const cand of [
        path.join(env.storagePath, "music", base),
        path.join(env.storagePath, "music", "stock", base),
      ]) {
        if (fs.existsSync(cand)) { musicPath = cand; break; }
      }
    }

    if (!fs.existsSync(musicPath)) {
      return NextResponse.json(
        { error: `Music file not found: ${musicPath}. Ensure music generation completed.` },
        { status: 404 }
      );
    }

    // Extract mix volumes from mixSettings
    const mixSettings = recording.mixSettings as Record<string, unknown> | null;
    const voiceVolume = typeof mixSettings?.voiceVolume === "number" ? mixSettings.voiceVolume : 1.0;
    const musicVolume = typeof mixSettings?.musicVolume === "number" ? mixSettings.musicVolume : 0.7;

    // Output path
    const assembledDir = path.join(env.storagePath, "karaoke", "assembled");
    fs.mkdirSync(assembledDir, { recursive: true });
    const timestamp = Date.now();
    const outputFilename = `${recordingId}_${timestamp}.mp3`;
    const outputPath = path.join(assembledDir, outputFilename);
    const outputUrl = `/api/media/karaoke/assembled/${outputFilename}`;

    await runFFmpegMix(voicePath, musicPath, outputPath, voiceVolume, musicVolume);

    // Save to DB
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { mixedOutputUrl: outputUrl },
    });

    return NextResponse.json({
      recordingId,
      mixedOutputUrl: outputUrl,
      outputPath,
    });
  } catch (err) {
    console.error("[karaoke/assemble] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assembly failed" },
      { status: 500 }
    );
  }
}
