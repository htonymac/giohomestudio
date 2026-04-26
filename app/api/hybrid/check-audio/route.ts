// POST /api/hybrid/check-audio
// Checks a video file's audio using ffprobe + faster-whisper transcription.
// Returns: hasAudio, silent, duration, sampleRate, fileSizeBytes, transcript

import { NextRequest, NextResponse } from "next/server";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
    }

    // Resolve URL to file path
    let filePath: string | null = null;
    const mediaMatch = videoUrl.match(/\/api\/media\/(.+)/);
    if (mediaMatch) {
      filePath = path.join(env.storagePath, mediaMatch[1].replace(/\//g, path.sep));
    } else if (fs.existsSync(videoUrl)) {
      filePath = videoUrl;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found", videoUrl, filePath }, { status: 404 });
    }

    const ffprobe = env.ffprobePath || "ffprobe";
    const ffmpeg = env.ffmpegPath || "ffmpeg";

    // ── Step 1: ffprobe stream info ──
    const { stdout } = await execFileAsync(ffprobe, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    const streams = info.streams || [];
    const audioStreams = streams.filter((s: { codec_type: string }) => s.codec_type === "audio");
    const videoStreams = streams.filter((s: { codec_type: string }) => s.codec_type === "video");
    const duration = parseFloat(info.format?.duration || "0");
    const fileSizeBytes = parseInt(info.format?.size || "0");
    const hasAudio = audioStreams.length > 0;
    const sampleRate = audioStreams[0]?.sample_rate || null;

    // ── Step 2: Whisper transcription (first 60s max) ──
    let transcript = "";
    let silent = false;
    let whisperError = "";

    if (hasAudio) {
      const tmpWav = path.join(os.tmpdir(), `ghs_ear_${Date.now()}.wav`);
      try {
        // Extract audio to 16kHz mono WAV (Whisper format) — first 60s
        await execFileAsync(ffmpeg, [
          "-i", filePath,
          "-t", "60",
          "-vn",
          "-ar", "16000",
          "-ac", "1",
          "-f", "wav",
          "-y", tmpWav,
        ], { timeout: 30000 });

        if (fs.existsSync(tmpWav)) {
          // Run faster-whisper via Python
          const pyScript = `
import sys
try:
    from faster_whisper import WhisperModel
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe("${tmpWav.replace(/\\/g, "/")}", beam_size=3, language="en")
    text = " ".join(seg.text.strip() for seg in segments)
    print(text.strip())
except Exception as e:
    print("WHISPER_ERROR:" + str(e), file=sys.stderr)
    sys.exit(1)
`.trim();

          transcript = await new Promise<string>((resolve) => {
            // Resolve python binary: env var → PATH fallback (linux: python3, windows: python)
            const envPython = process.env.PYTHON_BIN;
            const pythonExe = (envPython && fs.existsSync(envPython)) ? envPython : (process.platform === "win32" ? "python" : "python3");
            const proc = spawn(pythonExe, ["-c", pyScript], { timeout: 60000 });
            let out = "";
            let err = "";
            proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
            proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
            proc.on("close", () => {
              if (err && err.includes("WHISPER_ERROR")) {
                whisperError = err.replace("WHISPER_ERROR:", "").trim();
                resolve("");
              } else {
                resolve(out.trim());
              }
            });
            proc.on("error", (e) => { whisperError = e.message; resolve(""); });
          });

          // Clean up temp file
          try { fs.unlinkSync(tmpWav); } catch { /* ignore */ }

          // Detect silence: very short transcript = likely silent
          silent = transcript.length < 5;
        }
      } catch (extractErr) {
        whisperError = extractErr instanceof Error ? extractErr.message : "audio extract failed";
      }
    } else {
      silent = true;
    }

    return NextResponse.json({
      ok: true,
      hasAudio,
      hasVideo: videoStreams.length > 0,
      audioStreams: audioStreams.length,
      videoStreams: videoStreams.length,
      duration,
      fileSizeBytes,
      audioCodec: audioStreams[0]?.codec_name || null,
      audioChannels: audioStreams[0]?.channels || null,
      audioSampleRate: sampleRate,
      filePath,
      // Ears output
      transcript,
      silent,
      whisperError: whisperError || undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "check-audio failed" },
      { status: 500 }
    );
  }
}
