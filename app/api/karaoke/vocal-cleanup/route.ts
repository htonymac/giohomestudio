// POST /api/karaoke/vocal-cleanup — Karaoke Step 2 (Demucs)
//
// Separates vocals from background noise using Demucs htdemucs model.
// Required for clean karaoke analysis (Step 3), accurate lyric extraction
// (Step 5), and the "vocal only" / "instrumental only" exports (Step 16).
//
// Henry 2026-05-31 (#7+): wire-up after server install of Demucs.
//
// NOTE: Demucs on CPU is slow — expect ~1 minute per 60s of audio. The
// route has a 10-minute timeout. Long jobs should run async; for now the
// client must keep the connection open. Async/queue refactor is TODO.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startMs = Date.now();

  try {
    // 1. Parse body
    let body: { recordingId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { recordingId } = body;
    if (!recordingId) {
      return NextResponse.json({ error: "recordingId is required" }, { status: 400 });
    }

    // 2. Look up recording
    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    // 3. Convert fileUrl → disk path
    // fileUrl is like /api/media/karaoke/<file>.wav
    // strip /api/media/ prefix and join with storagePath
    const fileUrl = recording.fileUrl;
    const mediaPrefix = "/api/media/";
    if (!fileUrl.startsWith(mediaPrefix)) {
      return NextResponse.json(
        { error: `Unexpected fileUrl format: ${fileUrl}` },
        { status: 500 }
      );
    }
    const relativePath = fileUrl.slice(mediaPrefix.length); // e.g. karaoke/<file>.wav
    const inputDiskPath = path.join(env.storagePath, relativePath);

    // 4. Check input file exists
    if (!fs.existsSync(inputDiskPath)) {
      return NextResponse.json(
        { error: `Input file not found on disk: ${inputDiskPath}` },
        { status: 500 }
      );
    }

    // 5. Build output directory
    const outDir = path.join(env.storagePath, "karaoke", "demucs", recordingId);
    fs.mkdirSync(outDir, { recursive: true });

    // 6. Run Demucs
    const demucsError = await runDemucs(inputDiskPath, outDir);
    if (demucsError) {
      return NextResponse.json({ error: demucsError }, { status: 500 });
    }

    // 7. Locate output files
    const basename = path.basename(inputDiskPath, path.extname(inputDiskPath));
    const vocalDiskPath = path.join(outDir, "htdemucs", basename, "vocals.wav");
    const instrumentalDiskPath = path.join(outDir, "htdemucs", basename, "no_vocals.wav");

    if (!fs.existsSync(vocalDiskPath)) {
      return NextResponse.json(
        { error: `Demucs vocals output missing: ${vocalDiskPath}` },
        { status: 500 }
      );
    }
    if (!fs.existsSync(instrumentalDiskPath)) {
      return NextResponse.json(
        { error: `Demucs instrumental output missing: ${instrumentalDiskPath}` },
        { status: 500 }
      );
    }

    // 8. Build served URLs
    const vocalUrl = `/api/media/karaoke/demucs/${recordingId}/htdemucs/${basename}/vocals.wav`;
    const instrumentalUrl = `/api/media/karaoke/demucs/${recordingId}/htdemucs/${basename}/no_vocals.wav`;

    // 9. Persist URLs into analysis JSON field
    const existingAnalysis = (recording.analysis ?? {}) as Record<string, unknown>;
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: {
        analysis: {
          ...existingAnalysis,
          vocalStemUrl: vocalUrl,
          instrumentalStemUrl: instrumentalUrl,
        },
      },
    });

    // 10. Return success
    const tookMs = Date.now() - startMs;
    return NextResponse.json({
      ok: true,
      recordingId,
      vocalUrl,
      instrumentalUrl,
      tookMs,
    });
  } catch (err) {
    console.error("[vocal-cleanup] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Demucs runner — returns null on success, error string on failure
// ---------------------------------------------------------------------------
function runDemucs(inputDiskPath: string, outDir: string): Promise<string | null> {
  return new Promise((resolve) => {
    const TIMEOUT_MS = 600_000; // 10 minutes

    const proc = spawn("/home/ghs/.local/bin/demucs", [
      "--two-stems=vocals",
      "-n",
      "htdemucs",
      "-o",
      outDir,
      inputDiskPath,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve(`Demucs timed out after ${TIMEOUT_MS / 1000}s`);
    }, TIMEOUT_MS);

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(null);
      } else {
        console.error("[vocal-cleanup] Demucs stdout:", stdout);
        console.error("[vocal-cleanup] Demucs stderr:", stderr);
        resolve(`Demucs exited with code ${code ?? "null"}. stderr: ${stderr.slice(0, 500)}`);
      }
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      console.error("[vocal-cleanup] Failed to spawn Demucs:", err);
      resolve(`Failed to spawn Demucs: ${err.message}`);
    });
  });
}
