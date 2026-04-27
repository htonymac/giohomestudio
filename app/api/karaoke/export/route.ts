// POST /api/karaoke/export
// Body: { recordingId: string, format: ExportFormat }
// Generates export file via FFmpeg and returns download URL.
// Updates exportedFiles JSON on KaraokeRecording.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

export type ExportFormat =
  | "mp3"
  | "wav"
  | "vocal_only"
  | "instrumental_only"
  | "karaoke_lyric_timed"
  | "short_clip"
  | "hook_segment";

const EXPORT_FORMATS: ExportFormat[] = [
  "mp3",
  "wav",
  "vocal_only",
  "instrumental_only",
  "karaoke_lyric_timed",
  "short_clip",
  "hook_segment",
];

const TIMEOUT_MS = 60_000;

function runFFmpegExport(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`FFmpeg export timed out`));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg export exited ${code}: ${stderr.slice(-400)}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId, format } = body as { recordingId: string; format: ExportFormat };

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }
    if (!format || !EXPORT_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: `format must be one of: ${EXPORT_FORMATS.join(", ")}` },
        { status: 400 }
      );
    }

    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    // Determine source file
    const mixedUrl = recording.mixedOutputUrl;
    const voiceUrl = recording.fileUrl;
    const musicUrl = recording.generatedMusicUrl;

    const resolveKaraokeFile = (url: string): string => {
      const match = url.match(/\/api\/media\/karaoke\/(.+)/);
      if (match) return path.join(env.storagePath, "karaoke", match[1]);
      // assembled subfolder
      const matchAssembled = url.match(/\/api\/media\/karaoke\/assembled\/(.+)/);
      if (matchAssembled) return path.join(env.storagePath, "karaoke", "assembled", matchAssembled[1]);
      return url;
    };

    const exportDir = path.join(env.storagePath, "karaoke", "exports");
    fs.mkdirSync(exportDir, { recursive: true });

    const timestamp = Date.now();
    let outputFilename: string;
    let outputUrl: string;
    let ffmpegArgs: string[];
    let sourceFile: string;

    switch (format) {
      case "mp3": {
        if (!mixedUrl) {
          return NextResponse.json({ error: "Run Final Assembly (Step 15) before MP3 export" }, { status: 400 });
        }
        sourceFile = resolveKaraokeFile(mixedUrl);
        outputFilename = `${recordingId}_${timestamp}_export.mp3`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        ffmpegArgs = ["-y", "-i", sourceFile, "-c:a", "libmp3lame", "-q:a", "2",
          path.join(exportDir, outputFilename)];
        break;
      }

      case "wav": {
        if (!mixedUrl) {
          return NextResponse.json({ error: "Run Final Assembly (Step 15) before WAV export" }, { status: 400 });
        }
        sourceFile = resolveKaraokeFile(mixedUrl);
        outputFilename = `${recordingId}_${timestamp}_export.wav`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        ffmpegArgs = ["-y", "-i", sourceFile, "-c:a", "pcm_s16le", "-ar", "44100",
          path.join(exportDir, outputFilename)];
        break;
      }

      case "vocal_only": {
        sourceFile = resolveKaraokeFile(voiceUrl);
        outputFilename = `${recordingId}_${timestamp}_vocal_only.mp3`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        ffmpegArgs = ["-y", "-i", sourceFile, "-c:a", "libmp3lame", "-q:a", "2",
          path.join(exportDir, outputFilename)];
        break;
      }

      case "instrumental_only": {
        if (!musicUrl) {
          return NextResponse.json({ error: "No instrumental available — run Music Generation first" }, { status: 400 });
        }
        // musicUrl may be stock path
        sourceFile = musicUrl.startsWith("/api/media/")
          ? resolveKaraokeFile(musicUrl)
          : path.join(process.cwd(), "storage", "music", path.basename(musicUrl));
        outputFilename = `${recordingId}_${timestamp}_instrumental.mp3`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        ffmpegArgs = ["-y", "-i", sourceFile, "-c:a", "libmp3lame", "-q:a", "2",
          path.join(exportDir, outputFilename)];
        break;
      }

      case "karaoke_lyric_timed": {
        // Vocal-only export (instrumental stripped); lyric timing in metadata
        sourceFile = resolveKaraokeFile(voiceUrl);
        outputFilename = `${recordingId}_${timestamp}_karaoke_timed.mp3`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        const lyricsComment = recording.transcript
          ? `Lyrics: ${recording.transcript.slice(0, 200)}`
          : "Karaoke timed version";
        ffmpegArgs = ["-y", "-i", sourceFile,
          "-metadata", `comment=${lyricsComment}`,
          "-metadata", `title=Karaoke Version`,
          "-c:a", "libmp3lame", "-q:a", "2",
          path.join(exportDir, outputFilename)];
        break;
      }

      case "short_clip": {
        // First 30 seconds of mixed output
        if (!mixedUrl) {
          return NextResponse.json({ error: "Run Final Assembly (Step 15) before short clip export" }, { status: 400 });
        }
        sourceFile = resolveKaraokeFile(mixedUrl);
        outputFilename = `${recordingId}_${timestamp}_short_clip.mp3`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        ffmpegArgs = ["-y", "-i", sourceFile, "-t", "30",
          "-c:a", "libmp3lame", "-q:a", "2",
          path.join(exportDir, outputFilename)];
        break;
      }

      case "hook_segment": {
        // First 15 seconds — likely contains hook
        sourceFile = resolveKaraokeFile(voiceUrl);
        outputFilename = `${recordingId}_${timestamp}_hook_segment.mp3`;
        outputUrl = `/api/media/karaoke/exports/${outputFilename}`;
        ffmpegArgs = ["-y", "-i", sourceFile, "-t", "15",
          "-c:a", "libmp3lame", "-q:a", "2",
          path.join(exportDir, outputFilename)];
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });
    }

    // Verify source exists
    if (!fs.existsSync(sourceFile)) {
      return NextResponse.json({ error: `Source file not found: ${sourceFile}` }, { status: 404 });
    }

    await runFFmpegExport(ffmpegArgs);

    // Append to exportedFiles JSON
    const existingExports = (recording.exportedFiles as Array<{format: string; url: string; createdAt: string}>) || [];
    const newExport = { format, url: outputUrl, createdAt: new Date().toISOString() };
    const updatedExports = [...existingExports, newExport];

    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { exportedFiles: updatedExports },
    });

    return NextResponse.json({
      recordingId,
      format,
      downloadUrl: outputUrl,
      exportedFiles: updatedExports,
    });
  } catch (err) {
    console.error("[karaoke/export] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
