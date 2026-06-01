// POST /api/karaoke/melody-extract — Karaoke Step 4 (Basic Pitch)
//
// Converts the user's voice WAV to MIDI note events using Spotify's Basic
// Pitch model. The MIDI tells the music generator the actual notes the user
// sang so the backing track can match the key. Without it, the music gen
// guesses key from tempo — often wrong.
//
// Henry 2026-05-31 (#7+): wire-up after server install of basic-pitch.
//
// NOTE: Basic Pitch on CPU takes ~10s per minute of audio. 3-minute timeout
// is generous. Async/queue refactor is TODO.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

const BASIC_PITCH_BIN = "/home/ghs/.local/bin/basic-pitch";
const TIMEOUT_MS = 180_000; // 3 min — Basic Pitch on CPU is slow

function runBasicPitch(
  outDir: string,
  inputDiskPath: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(BASIC_PITCH_BIN, [
      outDir,
      inputDiskPath,
      "--save-midi",
      "--no-sonification",
      "--no-model-output-json",
      "--no-save-note-events",
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Basic Pitch timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err = new Error("Basic Pitch process exited with non-zero code");
        (err as NodeJS.ErrnoException & { stderr: string; exitCode: number }).stderr = stderr;
        (err as NodeJS.ErrnoException & { stderr: string; exitCode: number }).exitCode = code ?? 1;
        reject(err);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn basic-pitch: ${err.message}`));
    });
  });
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  try {
    // 1. Parse body
    const body = await req.json();
    const { recordingId } = body as { recordingId?: string };

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    // 2. Fetch recording from DB
    const recording = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    // 3. Resolve disk path from fileUrl
    // fileUrl is like /api/media/karaoke/<file>.wav — strip /api/media/ prefix
    const mediaPrefix = "/api/media/";
    if (!recording.fileUrl.startsWith(mediaPrefix)) {
      return NextResponse.json(
        { error: `Unexpected fileUrl format: ${recording.fileUrl}` },
        { status: 500 }
      );
    }
    const relPath = recording.fileUrl.slice(mediaPrefix.length); // e.g. "karaoke/<file>.wav"
    const inputDiskPath = path.join(env.storagePath, relPath);

    // 4. Confirm input file exists
    if (!fs.existsSync(inputDiskPath)) {
      return NextResponse.json(
        { error: `Audio file not found on disk: ${inputDiskPath}` },
        { status: 500 }
      );
    }

    // 5. Build output directory
    const outDir = path.join(env.storagePath, "karaoke", "midi", recordingId);
    fs.mkdirSync(outDir, { recursive: true });

    // 6. Run Basic Pitch
    try {
      await runBasicPitch(outDir, inputDiskPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const structured = err as { stderr?: string; exitCode?: number };
      const fullStderr = structured.stderr ?? "";
      const exitCode = structured.exitCode ?? 1;
      console.error(`[karaoke/melody-extract] basic-pitch failed (exit ${exitCode}):`, msg, fullStderr);
      return NextResponse.json(
        { error: `Basic Pitch failed: ${msg}`, stderr: fullStderr, exitCode },
        { status: 500 }
      );
    }

    // 7. Locate produced MIDI file
    // basic-pitch writes: <outDir>/<basename>_basic_pitch.mid
    const basename = path.basename(inputDiskPath, path.extname(inputDiskPath));
    const midiDiskPath = path.join(outDir, basename + "_basic_pitch.mid");

    if (!fs.existsSync(midiDiskPath)) {
      console.error(`[karaoke/melody-extract] MIDI file not found after basic-pitch run: ${midiDiskPath}`);
      return NextResponse.json(
        { error: `MIDI output not found at expected path: ${midiDiskPath}` },
        { status: 500 }
      );
    }

    // 8. Estimate note count from file size (avoids heavy MIDI parsing)
    const stats = fs.statSync(midiDiskPath);
    const sizeBytes = stats.size;
    // Each MIDI note event is ~8-12 bytes typical; rough estimate works for UI display
    const noteCount = Math.max(1, Math.round((sizeBytes - 100) / 10));

    // 9. Build served URL
    const midiUrl = `/api/media/karaoke/midi/${recordingId}/${path.basename(midiDiskPath)}`;

    // 10. Persist to DB — merge into existing analysis JSON
    const existingAnalysis = (recording.analysis ?? {}) as Record<string, unknown>;
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: {
        analysis: { ...existingAnalysis, melodyMidiUrl: midiUrl, midiSizeBytes: sizeBytes },
      },
    });

    // 11. Return result
    const tookMs = Date.now() - startMs;
    return NextResponse.json({
      ok: true,
      recordingId,
      midiUrl,
      noteCount,
      tookMs,
    });
  } catch (err) {
    console.error("[karaoke/melody-extract] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Melody extraction failed" },
      { status: 500 }
    );
  }
}
