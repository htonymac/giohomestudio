// GioHomeStudio — Continuous Motion Continuity Engine (Session 2)
// Provider-independent. Handles frame extraction, prompt continuation, and clip assembly.
// Never calls any provider API directly — works through adapters via VideoProviderAdapter.
//
// Functions:
//   extractMotionAnchor(clipPath) — FFmpeg last-frame extraction → anchor JPEG
//   buildContinuationPrompt(prevPrompt, motionAction, anchorImageUrl) — builds "Continue:" prompt
//   assembleClips(clipPaths, outputPath) — FFmpeg concat → final.mp4

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnchorResult {
  anchorPath: string;       // local path to the extracted JPEG
  anchorUrl: string;        // URL (may be local file path on server or a served URL)
  extractedAt: string;      // ISO timestamp
}

export interface AssemblyResult {
  outputPath: string;
  clipCount: number;
  concatListPath: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

// FFmpeg flag: skip to 0.1s before end, extract 1 high-quality JPEG frame
const FFMPEG_ANCHOR_CMD = ["-sseof", "-0.1", "-i", "INPUT", "-frames:v", "1", "-q:v", "2", "-y", "OUTPUT"];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if FFmpeg is available in PATH.
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a URL to a local temp file. Used when clipPath is a remote URL.
 * Returns the local temp file path.
 */
async function downloadToTemp(url: string, ext = ".mp4"): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `ghs-cm-${Date.now()}${ext}`);
  // Use fetch (Node 18+) to download
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(tmpPath, buffer);
  return tmpPath;
}

// ── extractMotionAnchor ────────────────────────────────────────────────────

/**
 * Extract the last frame of a video clip as a high-quality JPEG.
 * This frame becomes the anchor for the next segment in the chain.
 *
 * @param clipPath  Local file path OR remote URL to the video clip.
 * @param outputDir Directory where the anchor JPEG will be saved.
 * @param segmentNumber  Used to name the anchor file (anchor_001.jpg etc.)
 * @returns AnchorResult with the path to the extracted JPEG.
 */
export async function extractMotionAnchor(
  clipPath: string,
  outputDir: string,
  segmentNumber: number
): Promise<AnchorResult> {
  const hasFfmpeg = await checkFfmpegAvailable();
  if (!hasFfmpeg) {
    throw new Error("FFmpeg not available — cannot extract motion anchor.");
  }

  // Ensure output dir exists
  await mkdir(outputDir, { recursive: true });

  const anchorFileName = `anchor_${String(segmentNumber).padStart(3, "0")}.jpg`;
  const anchorPath = path.join(outputDir, anchorFileName);

  // Download to local temp if remote URL
  let localClipPath = clipPath;
  let tempDownloaded = false;
  if (clipPath.startsWith("http://") || clipPath.startsWith("https://")) {
    localClipPath = await downloadToTemp(clipPath, ".mp4");
    tempDownloaded = true;
  }

  try {
    const args = FFMPEG_ANCHOR_CMD.map(a =>
      a === "INPUT" ? localClipPath : a === "OUTPUT" ? anchorPath : a
    );
    await execFileAsync("ffmpeg", args);

    if (!existsSync(anchorPath)) {
      throw new Error(`FFmpeg ran but anchor not found at ${anchorPath}`);
    }

    console.log(`[continuity-engine] Extracted anchor ${anchorFileName} from segment ${segmentNumber}`);
    return {
      anchorPath,
      anchorUrl: anchorPath, // caller serves this as needed
      extractedAt: new Date().toISOString(),
    };
  } finally {
    if (tempDownloaded && existsSync(localClipPath)) {
      unlink(localClipPath).catch(() => {});
    }
  }
}

// ── buildContinuationPrompt ────────────────────────────────────────────────

/**
 * Build the next-segment continuation prompt.
 * Always uses "Continue:" prefix so the provider knows to maintain visual continuity.
 *
 * @param prevPrompt     The prompt used for the previous segment (for reference).
 * @param motionAction   The physical action for this next segment (from motion planner).
 * @param anchorImageUrl URL/path of the anchor image (last frame of prev clip).
 *                       Included in the returned object for adapter use.
 * @returns Object with the continuation prompt string and anchorImageUrl.
 */
export function buildContinuationPrompt(
  prevPrompt: string,
  motionAction: string,
  anchorImageUrl: string
): { prompt: string; anchorImageUrl: string } {
  // Extract key descriptors from prevPrompt to maintain consistency
  // Strategy: preserve first 2 sentences of prevPrompt as "character/camera descriptor"
  const sentences = prevPrompt.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const contextDesc = sentences.slice(0, 2).join(" ").slice(0, 200);

  const prompt = `Continue: ${contextDesc} — ${motionAction}`;
  return { prompt, anchorImageUrl };
}

// ── assembleClips ─────────────────────────────────────────────────────────

/**
 * Assemble multiple video clips into a single video using FFmpeg concat demuxer.
 * All clips MUST be the same codec, resolution, and frame rate for -c copy to work.
 *
 * @param clipPaths   Array of local file paths (or remote URLs — will be downloaded).
 * @param outputPath  Full path for the assembled output MP4.
 * @returns AssemblyResult with output path and concat list path.
 */
export async function assembleClips(
  clipPaths: string[],
  outputPath: string
): Promise<AssemblyResult> {
  if (clipPaths.length === 0) {
    throw new Error("assembleClips: no clip paths provided.");
  }

  const hasFfmpeg = await checkFfmpegAvailable();
  if (!hasFfmpeg) {
    throw new Error("FFmpeg not available — cannot assemble clips.");
  }

  // Ensure output directory exists
  await mkdir(path.dirname(outputPath), { recursive: true });

  // Download remote clips to local temp files
  const localPaths: string[] = [];
  const tempFiles: string[] = [];

  for (const clipPath of clipPaths) {
    if (clipPath.startsWith("http://") || clipPath.startsWith("https://")) {
      const tmpPath = await downloadToTemp(clipPath, ".mp4");
      localPaths.push(tmpPath);
      tempFiles.push(tmpPath);
    } else {
      localPaths.push(clipPath);
    }
  }

  // Write concat list file
  const concatListPath = outputPath.replace(/\.mp4$/, "_list.txt");
  const listContent = localPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(concatListPath, listContent, "utf8");

  try {
    // FFmpeg concat
    await execFileAsync("ffmpeg", [
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      "-y",
      outputPath,
    ]);

    if (!existsSync(outputPath)) {
      throw new Error(`FFmpeg concat ran but output not found at ${outputPath}`);
    }

    console.log(`[continuity-engine] Assembled ${localPaths.length} clips → ${outputPath}`);
    return { outputPath, clipCount: localPaths.length, concatListPath };
  } finally {
    // Clean up temp downloaded files
    for (const tmp of tempFiles) {
      if (existsSync(tmp)) unlink(tmp).catch(() => {});
    }
  }
}

// ── Chain Runner ──────────────────────────────────────────────────────────

export interface ChainSegment {
  motionAction: string;
  duration: number;
}

export interface ChainRunOptions {
  segments: ChainSegment[];
  basePrompt: string;
  providerAdapter: import("./provider-router").VideoProviderAdapter;
  seed?: number;
  sceneId: string;
  outputDir: string;
}

export interface ChainRunResult {
  clipPaths: string[];
  anchorPaths: string[];
  finalVideoPath: string | null;
  completedSegments: number;
  failedAt: number | null;
  error?: string;
}

/**
 * Run the full continuity chain: generate seg 1 → extract anchor → generate seg 2 → ... → assemble.
 * Sequential only — never parallel within a scene (spec Rule 3).
 *
 * If FAL_KEY is missing or a segment fails, logs the failure and returns partial results.
 * Skips actual generation if FAL_KEY is not set (test environments).
 */
export async function runContinuityChain(options: ChainRunOptions): Promise<ChainRunResult> {
  const { segments, basePrompt, providerAdapter, seed, sceneId, outputDir } = options;
  const clipPaths: string[] = [];
  const anchorPaths: string[] = [];

  await mkdir(outputDir, { recursive: true });

  const falKeyAvailable = !!process.env.FAL_KEY;

  if (!falKeyAvailable) {
    console.log("[continuity-engine] FAL_KEY not set — skipping actual generation (test mode)");
    return {
      clipPaths: [],
      anchorPaths: [],
      finalVideoPath: null,
      completedSegments: 0,
      failedAt: null,
      error: "FAL_KEY not set — generation skipped",
    };
  }

  let prevAnchorUrl: string | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segNum = i + 1;
    const clipPath = path.join(outputDir, `clip_${String(segNum).padStart(3, "0")}.mp4`);

    let result: import("./provider-router").VideoGenerationResult;

    try {
      if (i === 0) {
        // First segment — generate from text
        result = await providerAdapter.generateFromText(basePrompt, seed, seg.duration);
      } else {
        // Continuation segments — generate from last anchor
        if (!prevAnchorUrl) throw new Error(`No anchor available for segment ${segNum}`);
        const { prompt } = buildContinuationPrompt(basePrompt, seg.motionAction, prevAnchorUrl);
        result = await providerAdapter.generateFromImage(prevAnchorUrl, prompt, seed, seg.duration);
      }

      // Download clip to local storage
      const clipBuffer = Buffer.from(await (await fetch(result.videoUrl)).arrayBuffer());
      await writeFile(clipPath, clipBuffer);
      clipPaths.push(clipPath);

      // Extract anchor for next segment
      const anchor = await extractMotionAnchor(clipPath, outputDir, segNum);
      anchorPaths.push(anchor.anchorPath);
      prevAnchorUrl = anchor.anchorPath;

      console.log(`[continuity-engine] Segment ${segNum}/${segments.length} complete`);
    } catch (err) {
      console.error(`[continuity-engine] Segment ${segNum} failed:`, err);
      return {
        clipPaths,
        anchorPaths,
        finalVideoPath: null,
        completedSegments: i,
        failedAt: segNum,
        error: String(err),
      };
    }
  }

  // Assemble all clips
  let finalVideoPath: string | null = null;
  try {
    const outputPath = path.join(outputDir, `scene_${sceneId}_final.mp4`);
    const assembly = await assembleClips(clipPaths, outputPath);
    finalVideoPath = assembly.outputPath;
  } catch (err) {
    console.error("[continuity-engine] Assembly failed:", err);
    return {
      clipPaths,
      anchorPaths,
      finalVideoPath: null,
      completedSegments: segments.length,
      failedAt: null,
      error: `Assembly failed: ${String(err)}`,
    };
  }

  return {
    clipPaths,
    anchorPaths,
    finalVideoPath,
    completedSegments: segments.length,
    failedAt: null,
  };
}
