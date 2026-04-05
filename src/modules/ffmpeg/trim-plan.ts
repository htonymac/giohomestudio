// GioHomeStudio — Multi-Segment TrimPlan Executor
// Cuts a video into approved segments and concatenates them into one output file.
// Used by /api/video-trimmer/execute.

import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { env } from "@/config/env";
import { trimVideo } from "./index";
import { toFFmpegPath } from "./utils";

ffmpeg.setFfmpegPath(env.ffmpegPath);
ffmpeg.setFfprobePath(env.ffprobePath);

// ── Types (mirrored in route — keep in sync) ──────────────────────────────────

export interface TrimSegment {
  segmentId: string;
  label: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  repeat: number;         // 1 = play once; 2 = play twice; etc.
  note: string;
}

export interface TrimRules {
  maxSceneDurationSec?: number;
  allowRepeat: boolean;
  commercialGoal: string;
  targetDurationSec?: number;
  addNarration: boolean;
  addCaptions: boolean;
}

export interface TrimPlan {
  planId: string;
  originalDuration: number;
  outputDuration: number;
  segments: TrimSegment[];
  structure: string;
  aiModel: string;
  userInstruction: string;
  trimRules: TrimRules;
}

export interface ExecuteTrimPlanResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// ── Main executor ─────────────────────────────────────────────────────────────

export async function executeTrimPlan(
  videoPath: string,
  plan: TrimPlan,
  outputPath: string
): Promise<ExecuteTrimPlanResult> {
  const absInput  = path.resolve(videoPath);
  const absOutput = path.resolve(outputPath);

  if (!fs.existsSync(absInput)) {
    return { success: false, error: `Source video not found: ${absInput}` };
  }

  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  const tmpDir = path.join(os.tmpdir(), `trimplan_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const tempFiles: string[] = [];

  try {
    let segIdx = 0;
    for (const seg of plan.segments) {
      const count = Math.max(1, seg.repeat ?? 1);
      for (let r = 0; r < count; r++) {
        const tempPath = path.join(tmpDir, `seg_${segIdx++}.mp4`);
        const result = await trimVideo(absInput, tempPath, seg.startSec, seg.endSec);
        if (!result.success || !result.outputPath) {
          return { success: false, error: `Segment "${seg.label}" trim failed: ${result.error}` };
        }
        tempFiles.push(result.outputPath);
      }
    }

    if (tempFiles.length === 0) {
      return { success: false, error: "No segments to concatenate" };
    }

    if (tempFiles.length === 1) {
      fs.copyFileSync(tempFiles[0], absOutput);
      return { success: true, outputPath: absOutput };
    }

    const concatListPath = path.join(tmpDir, "concat.txt");
    const lines = tempFiles.map(p => `file '${toFFmpegPath(path.resolve(p))}'`).join("\n");
    fs.writeFileSync(concatListPath, lines);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(toFFmpegPath(concatListPath))
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy", "-movflags +faststart"])
        .output(toFFmpegPath(absOutput))
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    return { success: true, outputPath: absOutput };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    // Clean up all temp segment files and directory
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ── ffprobe wrapper ───────────────────────────────────────────────────────────

export interface VideoMetadata {
  durationSec: number;
  width: number;
  height: number;
  format: string;
}

export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const videoStream = data.streams?.find(s => s.codec_type === "video");
      const durationSec = parseFloat(String(data.format?.duration ?? "0"));
      const width  = videoStream?.width  ?? 0;
      const height = videoStream?.height ?? 0;
      const format = data.format?.format_name?.split(",")[0] ?? "unknown";
      resolve({ durationSec, width, height, format });
    });
  });
}
