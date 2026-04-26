// POST /api/karaoke/analyze
// Body: { recordingId: string }
// Spawns Python script: scripts/karaoke_analyze.py <audio_path>
// Updates KaraokeRecording.analysis + KaraokeRecording.transcript
// Returns full analysis JSON

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { env } from "@/config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const SCRIPT_PATH = path.resolve(process.cwd(), "scripts", "karaoke_analyze.py");
const TIMEOUT_MS = 120_000; // 2 min for model load + transcription

function runPythonAnalysis(audioPath: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH, audioPath], {
      env: {
        ...process.env,
        WHISPER_MODEL: process.env.WHISPER_MODEL || "base",
      },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Python analysis timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Python exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId } = body;

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    // Fetch recording
    const recording = await prisma.karaokeRecording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    // Resolve audio file path from fileUrl
    // fileUrl is like /api/media/karaoke/<filename>
    const match = recording.fileUrl.match(/\/api\/media\/karaoke\/(.+)/);
    if (!match) {
      return NextResponse.json({ error: "Cannot resolve file path from fileUrl" }, { status: 500 });
    }
    const audioPath = path.join(env.storagePath, "karaoke", match[1]);

    if (!fs.existsSync(audioPath)) {
      return NextResponse.json({ error: `Audio file not found on disk: ${audioPath}` }, { status: 404 });
    }

    if (!fs.existsSync(SCRIPT_PATH)) {
      return NextResponse.json({ error: `Analysis script not found: ${SCRIPT_PATH}` }, { status: 500 });
    }

    // Run Python analysis
    let analysisData: Record<string, unknown>;
    let stderrLog = "";

    try {
      const { stdout, stderr } = await runPythonAnalysis(audioPath);
      stderrLog = stderr;

      // Parse JSON from stdout (last JSON object, in case Python prints logs before it)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON in Python output. stdout: ${stdout.slice(0, 300)}\nstderr: ${stderr.slice(0, 300)}`);
      }
      analysisData = JSON.parse(jsonMatch[0]);

      if (analysisData.error) {
        return NextResponse.json({ error: String(analysisData.error), stderr: stderrLog }, { status: 500 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Log to PROBLEM_AND_FIX.md if analysis fails
      try {
        const pfPath = path.resolve(process.cwd(), "PROBLEM_AND_FIX.md");
        const entry = `\n\n## Karaoke Analysis Error — ${new Date().toISOString()}\n**Recording:** ${recordingId}\n**Error:** ${msg}\n**Stderr:** ${stderrLog.slice(0, 1000)}\n`;
        fs.appendFileSync(pfPath, entry, "utf8");
      } catch { /* best effort */ }

      return NextResponse.json({ error: `Analysis failed: ${msg}`, stderr: stderrLog }, { status: 500 });
    }

    // Update DB
    const transcript = typeof analysisData.transcription === "string" ? analysisData.transcription : "";
    const durationSec = typeof analysisData.duration_seconds === "number" ? analysisData.duration_seconds : null;

    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: {
        analysis: analysisData as object,
        transcript,
        durationSec,
      },
    });

    return NextResponse.json({
      recordingId,
      analysis: analysisData,
    });
  } catch (err) {
    console.error("[karaoke/analyze] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
