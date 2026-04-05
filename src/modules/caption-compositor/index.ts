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
import { buildCaptionHtml, buildNarrationHtml } from "./html-builder";
import { renderCaptionsToPng } from "./capture";
import type { CaptionComposeInput, ComposeResult, AspectRatio, CaptionPosition, PresetName, CaptionAnimation } from "./types";
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

// ── Caption-only render (transparent PNGs for video overlay) ─────────────────
//
// Unlike composeCommercialSlides, this does NOT bake captions into the slide images.
// It only produces transparent-background caption PNGs that can be overlaid on
// the final motion video so the text stays fixed while the background moves.

export interface CaptionPngResult {
  idx: number;
  captionPngPath: string | null;   // null = no caption for this slide
  narrationPngPath: string | null; // null = no narration subtitle for this slide
  animation: CaptionAnimation;
}

export interface CaptionPngBatchInput {
  slides: Array<{
    imagePath: string;
    captionText?: string | null;
    captionPosition?: string | null;
    captionPreset?: string | null;
    fontOverride?: string | null;
    fontSizeScale?: number;
    animation?: CaptionAnimation | string;
    narrationText?: string | null;
    showNarration?: boolean;
    frameId: string;
  }>;
  aspectRatio: AspectRatio;
  workDir: string;
}

export async function renderCommercialCaptionPngs(
  input: CaptionPngBatchInput
): Promise<CaptionPngResult[]> {
  const { slides, aspectRatio, workDir } = input;
  fs.mkdirSync(workDir, { recursive: true });
  const { w, h } = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];

  const results: CaptionPngResult[] = slides.map((_, idx) => ({
    idx,
    captionPngPath: null,
    narrationPngPath: null,
    animation: "fade-up",
  }));

  type HtmlTask = { idx: number; pngPath: string; html: string; role: "caption" | "narration" };
  const tasks: HtmlTask[] = [];

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const anim = (s.animation as CaptionAnimation | undefined) ?? "fade-up";
    results[i].animation = anim;

    const captionText = s.captionText?.trim();
    if (captionText) {
      const html = buildCaptionHtml({
        text: captionText,
        position: (s.captionPosition ?? "bottom") as CaptionPosition,
        preset: (s.captionPreset ?? "realEstate") as PresetName,
        fontOverride: s.fontOverride ?? undefined,
        fontSizeScale: s.fontSizeScale ?? 0.7,  // default 70% — smaller than baked preset sizes
        aspectRatio,
      });
      const pngPath = path.join(workDir, `cap_${s.frameId}.png`);
      tasks.push({ idx: i, pngPath, html, role: "caption" });
      results[i].captionPngPath = pngPath;
    }

    if (s.showNarration && s.narrationText?.trim()) {
      const html = buildNarrationHtml(s.narrationText.trim(), aspectRatio);
      const pngPath = path.join(workDir, `nar_${s.frameId}.png`);
      tasks.push({ idx: i, pngPath, html, role: "narration" });
      results[i].narrationPngPath = pngPath;
    }
  }

  if (tasks.length === 0) return results;

  try {
    await renderCaptionsToPng(
      tasks.map(t => ({ html: t.html, outputPath: t.pngPath })),
      w, h
    );
    // Verify files actually exist; clear path if render failed
    for (const t of tasks) {
      if (!isActualFile(t.pngPath)) {
        if (t.role === "caption") results[t.idx].captionPngPath = null;
        else results[t.idx].narrationPngPath = null;
      }
    }
  } catch (err) {
    console.error(`[renderCommercialCaptionPngs] Playwright failed: ${err}`);
    for (const r of results) {
      r.captionPngPath = null;
      r.narrationPngPath = null;
    }
  }

  return results;
}

// ── Video caption overlay ─────────────────────────────────────────────────────
//
// Overlays transparent caption PNGs on top of a motion video.
// Captions are fixed on screen — they do NOT move with the Ken Burns effect.
// Each caption fades in / slides in at its slide start time.

export interface VideoOverlayItem {
  pngPath: string;       // transparent PNG — caption or narration
  startSec: number;      // when to show
  endSec: number;        // when to hide
  animation: CaptionAnimation;
}

type OverlayQuality = "draft" | "standard" | "high" | "cinema";

export async function overlayCaptionsOnVideo(
  videoPath: string,
  overlays: VideoOverlayItem[],
  outputPath: string,
  quality: OverlayQuality = "standard",
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  const qualityMap: Record<OverlayQuality, { crf: number; preset: string }> = {
    draft:    { crf: 26, preset: "fast" },
    standard: { crf: 20, preset: "medium" },
    high:     { crf: 16, preset: "slow" },
    cinema:   { crf: 12, preset: "slow" },
  };
  const enc = qualityMap[quality] ?? qualityMap.standard;
  const valid = overlays.filter(o => isActualFile(o.pngPath));
  if (valid.length === 0) {
    fs.copyFileSync(videoPath, outputPath);
    return { success: true, outputPath };
  }

  const cmd = ffmpeg(toFFmpegPath(videoPath));
  valid.forEach(ov => {
    cmd.input(toFFmpegPath(ov.pngPath));
    cmd.inputOptions(["-loop", "1"]);
  });

  const fadeDur = 0.35;
  const filterParts: string[] = [];
  let prevLabel = "0:v";

  valid.forEach((ov, i) => {
    const capIdx = i + 1;
    const st     = ov.startSec;
    const et     = ov.endSec;
    const outLabel = i === valid.length - 1 ? "vfinal" : `vc${i}`;
    const capLabel = `cp${i}`;

    // Fade in the alpha channel starting at the slide's start time
    filterParts.push(`[${capIdx}:v]format=rgba,fade=in:st=${st.toFixed(3)}:d=${fadeDur}:alpha=1[${capLabel}]`);

    // Build overlay x/y expressions for animation type
    // t = current output time; st = slide start time; prog = 0→1 over fadeDur
    const prog = `min((t-${st.toFixed(3)})/${fadeDur},1)`;
    let xExpr = "0";
    let yExpr = "0";

    if (ov.animation === "fade-up") {
      // Slide up 60px from below while fading in
      yExpr = `if(lte(t-${st.toFixed(3)},${fadeDur}),round(60*(1-${prog})),0)`;
    } else if (ov.animation === "fly-in-left") {
      xExpr = `if(lte(t-${st.toFixed(3)},${fadeDur}),round(-180*(1-${prog})),0)`;
    } else if (ov.animation === "fly-in-right") {
      xExpr = `if(lte(t-${st.toFixed(3)},${fadeDur}),round(180*(1-${prog})),0)`;
    }
    // "fade" and "none": x=0, y=0 — just the alpha fade handles the animation

    filterParts.push(
      `[${prevLabel}][${capLabel}]overlay=format=auto:x=${xExpr}:y=${yExpr}:enable='between(t,${st.toFixed(3)},${et.toFixed(3)})'[${outLabel}]`
    );
    prevLabel = outLabel;
  });

  return new Promise((resolve) => {
    cmd
      .on("start", (cmdStr: string) => console.log(`[overlayCaptionsOnVideo] cmd: ${cmdStr}`))
      .complexFilter(filterParts.join(";"))
      .outputOptions(["-map [vfinal]", "-c:v libx264", `-crf ${enc.crf}`, `-preset ${enc.preset}`, "-movflags +faststart", "-an"])
      .output(toFFmpegPath(outputPath))
      .on("end", () => resolve({ success: true, outputPath }))
      .on("error", (err: Error) => {
        console.warn(`[overlayCaptionsOnVideo] FFmpeg failed (${err.message}) — using motion video without captions`);
        try { fs.copyFileSync(videoPath, outputPath); } catch {}
        resolve({ success: false, outputPath: videoPath, error: err.message });
      })
      .run();
  });
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

export { buildCaptionHtml, buildNarrationHtml } from "./html-builder";
export type { CaptionRenderInput, PresetName, CaptionPosition, CaptionAnimation } from "./types";
export { PRESETS } from "./presets";
export { RENDER_DIMS } from "./types";
