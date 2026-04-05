// Caption Compositor — main entry point
//
// Pipeline per slide:
//   1. buildCaptionHtml()      → HTML string (CSS-safe, overflow-controlled)
//   2. renderCaptionsToPng()   → transparent PNG via Playwright
//   3. overlayCaption()        → FFmpeg overlay filter: slide + caption PNG → composed PNG
//
// FFmpeg is only used for image assembly (overlay).
// All text rendering happens in Chromium — no drawtext, no FFmpeg expressions.

import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import { toFFmpegPath, isActualFile } from "@/modules/ffmpeg/utils";
import { buildCaptionHtml } from "./html-builder";
import { renderCaptionsToPng } from "./capture";
import type { CaptionComposeInput, ComposeResult, AspectRatio, CaptionPosition, PresetName } from "./types";
import { RENDER_DIMS } from "./types";

ffmpeg.setFfmpegPath(env.ffmpegPath);

// ── Per-slide overlay ─────────────────────────────────────────────────────────

/**
 * Scale-crops a source image to the target render dimensions, then overlays
 * a pre-rendered transparent caption PNG on top.
 * Uses FFmpeg overlay filter only — no text rendering in FFmpeg.
 */
function overlayCaption(
  imagePath: string,
  captionPngPath: string,
  outputPath: string,
  width: number,
  height: number
): Promise<ComposeResult> {
  const absImage   = toFFmpegPath(path.resolve(imagePath));
  const absCaption = toFFmpegPath(path.resolve(captionPngPath));
  const absOut     = toFFmpegPath(path.resolve(outputPath));

  // Scale source to fill target, crop to exact dimensions, then overlay caption layer.
  const filter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[bg];[bg][1:v]overlay=0:0[out]`;

  return new Promise((resolve) => {
    ffmpeg()
      .input(absImage)
      .input(absCaption)
      .complexFilter(filter)
      .outputOptions(["-map [out]", "-frames:v 1"])
      .output(absOut)
      .on("end",   () => resolve({ success: true, outputPath: path.resolve(outputPath) }))
      .on("error", (err: Error) => resolve({ success: false, outputPath: "", error: err.message }))
      .run();
  });
}

// ── Batch compose ─────────────────────────────────────────────────────────────

export interface BatchComposeInput {
  slides: Array<{
    imagePath: string;
    captionText: string | null | undefined;
    captionPosition?: string | null;
    captionPreset?: string | null;
    fontOverride?: string | null;
    frameId: string;
  }>;
  aspectRatio: AspectRatio;
  workDir: string;
}

export interface BatchComposeResult {
  /** Composed image path (replaces original imagePath in the slideshow frame).
   *  Falls back to the original imagePath if composition failed or had no caption. */
  imagePath: string;
  success: boolean;
}

/**
 * Composes captions onto all slide images in a batch.
 * Uses one Playwright browser session for all HTML→PNG renders.
 * Falls back to the original image path if any step fails.
 */
export async function composeCommercialSlides(
  input: BatchComposeInput
): Promise<BatchComposeResult[]> {
  const { slides, aspectRatio, workDir } = input;
  fs.mkdirSync(workDir, { recursive: true });

  const { w, h } = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];

  // ── Phase 1: Build HTML strings for slides that have captions ────────────
  type SlideTask = {
    idx: number;
    imagePath: string;
    captionPngPath: string;
    composedPath: string;
    html: string;
  };

  const tasks: SlideTask[] = [];
  const results: BatchComposeResult[] = slides.map(s => ({
    imagePath: s.imagePath,  // default: fall back to original
    success: false,
  }));

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const text  = slide.captionText?.trim();

    if (!text || !isActualFile(slide.imagePath)) {
      // No caption or no image — keep original path, mark as no-op success
      results[i] = { imagePath: slide.imagePath, success: true };
      continue;
    }

    const preset   = (slide.captionPreset ?? "realEstate") as PresetName;
    const position = (slide.captionPosition ?? "bottom") as CaptionPosition;

    const html = buildCaptionHtml({
      text,
      position,
      preset,
      fontOverride: slide.fontOverride ?? undefined,
      aspectRatio,
    });

    const captionPngPath = path.join(workDir, `cap_${slide.frameId}.png`);
    const composedPath   = path.join(workDir, `composed_${slide.frameId}.png`);

    tasks.push({ idx: i, imagePath: slide.imagePath, captionPngPath, composedPath, html });
  }

  if (tasks.length === 0) return results;

  // ── Phase 2: Render all HTML→PNG in one Playwright browser session ────────
  try {
    await renderCaptionsToPng(
      tasks.map(t => ({ html: t.html, outputPath: t.captionPngPath })),
      w,
      h
    );
  } catch (err) {
    console.error(`[CaptionCompositor] Playwright render failed: ${err} — falling back to no-caption`);
    // Return original paths for all tasks
    for (const t of tasks) {
      results[t.idx] = { imagePath: t.imagePath, success: false };
    }
    return results;
  }

  // ── Phase 3: FFmpeg overlay — one per slide ───────────────────────────────
  await Promise.all(
    tasks.map(async (t) => {
      if (!isActualFile(t.captionPngPath)) {
        console.warn(`[CaptionCompositor] Caption PNG missing for frame ${t.idx}, using original`);
        results[t.idx] = { imagePath: t.imagePath, success: false };
        return;
      }
      const result = await overlayCaption(t.imagePath, t.captionPngPath, t.composedPath, w, h);
      if (result.success) {
        results[t.idx] = { imagePath: result.outputPath, success: true };
      } else {
        console.warn(`[CaptionCompositor] Overlay failed for frame ${t.idx}: ${result.error} — using original`);
        results[t.idx] = { imagePath: t.imagePath, success: false };
      }
    })
  );

  return results;
}

// ── Cleanup helper ────────────────────────────────────────────────────────────

/** Delete all temp files (caption PNGs and composed PNGs) after slideshow is built */
export function cleanupComposedDir(workDir: string): void {
  try {
    const files = fs.readdirSync(workDir);
    for (const f of files) {
      if (f.startsWith("cap_") || f.startsWith("composed_")) {
        fs.unlinkSync(path.join(workDir, f));
      }
    }
  } catch {
    // Non-fatal — temp files will be cleaned up on next run or OS cleanup
  }
}

export { buildCaptionHtml } from "./html-builder";
export type { CaptionRenderInput, PresetName, CaptionPosition } from "./types";
export { PRESETS } from "./presets";
export { RENDER_DIMS } from "./types";
