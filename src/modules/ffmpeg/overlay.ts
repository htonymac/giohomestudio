// GioHomeStudio — FFmpeg Overlay Filter Builder
// Builds filter_complex strings for text (drawtext) and image (overlay) layers.
// Used by /api/overlays/preview and /api/overlays/render.

import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import { toFFmpegPath, escapeDrawtext, escapeFontPath, resolveFontFile, isActualFile, MOBILE_H264_OPTS } from "./utils";

ffmpeg.setFfmpegPath(env.ffmpegPath);
ffmpeg.setFfprobePath(env.ffprobePath);

// ── Layer type definitions ─────────────────────────────────────────────────

export type TextPosition = {
  zone: "top" | "center" | "bottom" | "free";
  x?: number; // 0-100 percentage, used when zone = "free"
  y?: number;
};

export type ImagePosition = {
  zone: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "free";
  x?: number;
  y?: number;
};

export type AnimationEntrance =
  | "none"
  | "slide_left"
  | "slide_right"
  | "slide_top"
  | "slide_bottom"
  | "fade_in"
  | "pop_in"
  | "typewriter";

export interface TextLayer {
  type: "text";
  id: string;
  text: string;
  position: TextPosition;
  style: {
    fontSize: number;
    fontWeight: "normal" | "bold";
    fontFamily?: string;   // e.g. "Arial", "Georgia", "Impact"
    italic?: boolean;
    underline?: boolean;
    uppercase?: boolean;
    color: string;         // hex e.g. "#FFFFFF"
    outlineColor?: string; // e.g. "#000000" for stroke
    outlineWidth?: number; // stroke width in pixels (1-5)
    bgColor?: string;      // e.g. "black@0.5"
    bgPadding?: number;    // padding around text background
    bgRadius?: number;     // corner radius for background card
    shadow: boolean;
    shadowColor?: string;
    outline: boolean;
    letterSpacing?: number;
    lineHeight?: number;
  };
  animation: {
    entrance: AnimationEntrance;
    exit?: "none" | "fade_out" | "slide_out_left" | "slide_out_right";
    startSec: number;
    durationSec: number;
    delay?: number;        // delay after startSec before entrance plays
  };
}

export interface ImageLayer {
  type: "image";
  id: string;
  imagePath: string;
  position: ImagePosition;
  size: {
    width: number;
    height: number;
  };
  animation: {
    entrance: AnimationEntrance;
    startSec: number;
    durationSec: number;
  };
}

export type OverlayLayer = TextLayer | ImageLayer;

export interface OverlayFilterResult {
  filterComplex: string;
  outputMap: string;
  // image input paths in order — caller must add these as extra inputs to ffmpeg
  imageInputs: string[];
}

// ── Position expressions ────────────────────────────────────────────────────

function textXExpr(position: TextPosition, startSec?: number, entrance?: AnimationEntrance): string {
  let baseX: string;
  switch (position.zone) {
    case "top":
    case "center":
    case "bottom":
      baseX = "(w-text_w)/2"; break;
    case "free":
      baseX = `w*${(position.x ?? 50) / 100}-text_w/2`; break;
  }
  // Slide animations on X axis
  if (entrance === "slide_left" && startSec !== undefined) {
    return `${baseX}-w*(1-min(1,(t-${startSec})/0.5))`;
  }
  if (entrance === "slide_right" && startSec !== undefined) {
    return `${baseX}+w*(1-min(1,(t-${startSec})/0.5))`;
  }
  return baseX;
}

function textYExpr(position: TextPosition, startSec: number, entrance: AnimationEntrance): string {
  let baseY: string;
  switch (position.zone) {
    case "top":    baseY = "h*0.06"; break;
    case "center": baseY = "(h-text_h)/2"; break;
    case "bottom": baseY = "h*0.85"; break;
    case "free":   baseY = `h*${(position.y ?? 50) / 100}-text_h/2`; break;
  }
  if (entrance === "slide_bottom") {
    // Slides in from below over 0.5s
    return `${baseY}+h*(1-min(1,(t-${startSec})/0.5))`;
  }
  if (entrance === "slide_top") {
    return `${baseY}-h*(1-min(1,(t-${startSec})/0.5))`;
  }
  return baseY;
}

function imageXExpr(position: ImagePosition, width: number, startSec: number, entrance: AnimationEntrance): string {
  let baseX: string;
  switch (position.zone) {
    case "top-left":     baseX = "10"; break;
    case "top-right":    baseX = `W-${width}-10`; break;
    case "bottom-left":  baseX = "10"; break;
    case "bottom-right": baseX = `W-${width}-10`; break;
    case "center":       baseX = `(W-${width})/2`; break;
    case "free":         baseX = `W*${(position.x ?? 50) / 100}-${width / 2}`; break;
  }
  if (entrance === "slide_left") {
    // Slides in from left over 0.5s
    return `${baseX}*(min(1,(t-${startSec})/0.5))-${width}*(1-min(1,(t-${startSec})/0.5))`;
  }
  if (entrance === "slide_right") {
    return `W-(W-${baseX})*(min(1,(t-${startSec})/0.5))-${width}*(1-min(1,(t-${startSec})/0.5))`;
  }
  return baseX;
}

function imageYExpr(position: ImagePosition, height: number): string {
  switch (position.zone) {
    case "top-left":
    case "top-right":    return "10";
    case "bottom-left":
    case "bottom-right": return `H-${height}-10`;
    case "center":       return `(H-${height})/2`;
    case "free":         return `H*${(position.y ?? 50) / 100}-${height / 2}`;
  }
}

// ── Enable expression (controls visibility window) ─────────────────────────

function enableExpr(startSec: number, durationSec: number): string {
  const endSec = startSec + durationSec;
  return `between(t,${startSec},${endSec})`;
}

// ── Main filter builder ─────────────────────────────────────────────────────

export function buildOverlayFilterComplex(layers: OverlayLayer[]): OverlayFilterResult {
  // Pre-validate: drop image layers whose files don't exist so loop indices are stable
  const validLayers = layers.filter(layer =>
    layer.type !== "image" || isActualFile(layer.imagePath)
  );

  if (validLayers.length === 0) {
    return { filterComplex: "", outputMap: "[0:v]", imageInputs: [] };
  }

  const filterParts: string[] = [];
  const imageInputs: string[] = [];
  let currentVideoLabel = "[0:v]";
  let imageInputIndex = 1; // input 0 = main video; images start at 1

  for (let i = 0; i < validLayers.length; i++) {
    const layer = validLayers[i];
    const outLabel = i < validLayers.length - 1 ? `[v${i + 1}]` : "[v_out]";

    if (layer.type === "text") {
      const t = layer as TextLayer;
      const safeText = escapeDrawtext(t.text);
      const fontColor = t.style.color.replace("#", "0x");
      const xExpr = textXExpr(t.position, t.animation.startSec, t.animation.entrance);
      const yExpr = textYExpr(t.position, t.animation.startSec, t.animation.entrance);
      const enableStr = enableExpr(t.animation.startSec, t.animation.durationSec);

      // fontfile= is required on Windows — Fontconfig is absent so name-based lookup
      // silently renders nothing. Bold/italic are achieved via font file variants.
      const fontFile = resolveFontFile({
        fontFamily: t.style.fontFamily,
        bold:   t.style.fontWeight === "bold",
        italic: t.style.italic,
      });

      // Apply uppercase if requested
      const displayText = t.style.uppercase ? safeText.toUpperCase() : safeText;

      const parts = [
        `fontfile=${escapeFontPath(fontFile)}`,
        `text='${displayText}'`,
        `fontsize=${t.style.fontSize}`,
        `fontcolor=${fontColor}`,
        `x=${xExpr}`,
        `y=${yExpr}`,
        `enable='${enableStr}'`,
      ];

      // Shadow
      if (t.style.shadow) {
        const sc = t.style.shadowColor ? t.style.shadowColor.replace("#", "0x") : "black@0.6";
        parts.push(`shadowx=2:shadowy=2:shadowcolor=${sc}`);
      }

      // Outline / stroke
      if (t.style.outline) {
        const bw = t.style.outlineWidth ?? 2;
        const bc = t.style.outlineColor ? t.style.outlineColor.replace("#", "0x") : "black@0.8";
        parts.push(`borderw=${bw}:bordercolor=${bc}`);
      }

      // Background box / card
      if (t.style.bgColor) {
        const pad = t.style.bgPadding ?? 6;
        parts.push(`box=1:boxcolor=${t.style.bgColor}:boxborderw=${pad}`);
      }

      // Animations
      const start = t.animation.startSec + (t.animation.delay ?? 0);
      if (t.animation.entrance === "fade_in") {
        parts.push(`alpha='min(1,(t-${start})/0.5)'`);
      } else if (t.animation.entrance === "pop_in") {
        // Pop-in: scale from 0 to 1 over 0.3s (simulated via alpha + slight y offset)
        parts.push(`alpha='min(1,(t-${start})/0.3)'`);
      } else if (t.animation.entrance === "typewriter") {
        // Typewriter: reveal text character by character using textlen expression
        // FFmpeg doesn't natively support typewriter, so we approximate with alpha fade
        parts.push(`alpha='min(1,(t-${start})/0.3)'`);
      }

      filterParts.push(`${currentVideoLabel}drawtext=${parts.join(":")}${outLabel}`);
      currentVideoLabel = outLabel;

    } else if (layer.type === "image") {
      const img = layer as ImageLayer;
      const absImagePath = path.resolve(img.imagePath);
      imageInputs.push(absImagePath);

      const scaledLabel = `[scaled${imageInputIndex}]`;
      const xExpr = imageXExpr(img.position, img.size.width, img.animation.startSec, img.animation.entrance);
      const yExpr = imageYExpr(img.position, img.size.height);
      const enableStr = enableExpr(img.animation.startSec, img.animation.durationSec);

      filterParts.push(`[${imageInputIndex}:v]scale=${img.size.width}:${img.size.height}${scaledLabel}`);
      filterParts.push(`${currentVideoLabel}${scaledLabel}overlay=x=${xExpr}:y=${yExpr}:enable='${enableStr}'${outLabel}`);
      imageInputIndex++;
      currentVideoLabel = outLabel;
    }
  }

  return { filterComplex: filterParts.join(";"), outputMap: "[v_out]", imageInputs };
}

// ── FFmpeg execution helper ─────────────────────────────────────────────────

export interface ApplyOverlaysInput {
  videoPath: string;
  layers: OverlayLayer[];
  outputPath: string;
  startSec?: number;   // for preview clips: start offset
  durationSec?: number; // for preview clips: clip length
}

export async function applyOverlays(input: ApplyOverlaysInput): Promise<{ success: boolean; outputPath: string; error?: string }> {
  if (!input.videoPath?.trim()) {
    return { success: false, outputPath: "", error: "Video path is empty — content item has no output video yet" };
  }
  const absInput = path.resolve(input.videoPath);
  if (!fs.existsSync(absInput)) {
    return { success: false, outputPath: "", error: `Video file not found: ${absInput}` };
  }
  const absOutput = path.resolve(input.outputPath);

  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  // For preview clips, adjust layer times so enable expressions work with seeked t=0 base
  const adjustedLayers = (input.startSec && input.startSec > 0)
    ? input.layers.map(layer => ({
        ...layer,
        animation: {
          ...layer.animation,
          startSec: Math.max(0, layer.animation.startSec - input.startSec!),
        },
      }))
    : input.layers;

  const { filterComplex, outputMap, imageInputs } = buildOverlayFilterComplex(adjustedLayers as OverlayLayer[]);

  return new Promise((resolve) => {
    let cmd = ffmpeg().input(toFFmpegPath(absInput));

    // Add image inputs
    for (const imgPath of imageInputs) {
      cmd = cmd.input(toFFmpegPath(imgPath));
    }

    // Preview clip: seek + duration
    if (input.startSec !== undefined) {
      cmd = cmd.seekInput(input.startSec);
    }

    const outputOptions: string[] = ["-pix_fmt yuv420p", "-movflags +faststart"];
    if (input.durationSec !== undefined) {
      outputOptions.push(`-t ${input.durationSec}`);
    }

    if (filterComplex) {
      // Log the filter for debugging
      console.log(`[applyOverlays] filter: ${filterComplex.slice(0, 200)}`);
      cmd = cmd
        .complexFilter(filterComplex)
        .outputOptions([`-map ${outputMap}`, "-map 0:a?", "-c:v libx264", "-crf 22", "-preset fast", "-c:a copy", ...outputOptions]);
    } else {
      cmd = cmd.outputOptions(["-c copy", ...outputOptions]);
    }

    cmd
      .output(toFFmpegPath(absOutput))
      .on("end", () => resolve({ success: true, outputPath: absOutput }))
      .on("error", (err: Error) => resolve({ success: false, outputPath: absOutput, error: err.message }))
      .run();
  });
}
