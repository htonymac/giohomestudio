// Caption Compositor — HTML builder
// Produces a complete self-contained HTML string that Playwright can render to a
// transparent-background PNG.  All text is CSS-constrained to safe zones —
// no text can overflow outside the frame boundary.

import { PRESETS } from "./presets";
import type { CaptionRenderInput, CaptionPosition } from "./types";
import { RENDER_DIMS } from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Parse raw text into headline + up to 3 sublines */
function parseLines(text: string): { headline: string; sublines: string[] } {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  return {
    headline:  lines[0]  ?? "",
    sublines:  lines.slice(1, 4),   // max 3 sublines — more would overflow
  };
}

function justifyContent(pos: CaptionPosition): string {
  if (pos === "top")    return "flex-start";
  if (pos === "center") return "center";
  return "flex-end";
}

function buildGradient(gradient: string, pos: CaptionPosition): string {
  if (pos === "top") return gradient.replace("to top", "to bottom");
  if (pos === "center") return "rgba(0,0,0,0.78)";
  return gradient;
}

export function buildCaptionHtml(input: CaptionRenderInput): string {
  const { text, position, preset: presetName, fontOverride, aspectRatio } = input;
  const preset  = PRESETS[presetName] ?? PRESETS.realEstate;
  const { w, h } = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];
  const { headline, sublines } = parseLines(text);

  if (!headline) return buildEmptyHtml(w, h);

  const fontStack  = fontOverride ? `"${fontOverride}", ${preset.fontStack}` : preset.fontStack;
  const justify    = justifyContent(position);
  const gradient   = buildGradient(preset.gradient, position);

  // For center: symmetric vertical padding; for top/bottom: asymmetric
  const padTop    = position === "center" ? 28 : position === "top" ? preset.padBottom : preset.padTop;
  const padBottom = position === "center" ? 28 : position === "top" ? preset.padTop    : preset.padBottom;

  const sublineHtml = sublines
    .map(l => `    <p class="sub">${escapeHtml(l)}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${w}px;
    height: ${h}px;
    background: transparent;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .layer {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: ${justify};
  }
  .card {
    background: ${gradient};
    padding: ${padTop}px ${preset.padSide}px ${padBottom}px;
    max-height: ${preset.maxCardHeight};
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: ${preset.blockGap}px;
    flex-shrink: 0;
  }
  .hl {
    font-family: ${fontStack};
    font-size: ${preset.headlineSize}px;
    font-weight: ${preset.headlineWeight};
    color: ${preset.headlineColor};
    text-transform: ${preset.headlineTransform};
    letter-spacing: ${preset.headlineLetterSpacing};
    line-height: 1.15;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: ${preset.headlineLineClamp};
    -webkit-box-orient: vertical;
    text-shadow: ${preset.textShadow};
  }
  .sub {
    font-family: ${fontStack};
    font-size: ${preset.sublineSize}px;
    font-weight: ${preset.sublineWeight};
    color: ${preset.sublineColor};
    letter-spacing: ${preset.sublineLetterSpacing};
    line-height: 1.35;
    word-break: break-word;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-shadow: 0 2px 10px rgba(0,0,0,0.85);
  }
</style>
</head>
<body>
<div class="layer">
  <div class="card">
    <p class="hl">${escapeHtml(headline)}</p>
${sublineHtml}
  </div>
</div>
</body>
</html>`;
}

function buildEmptyHtml(w: number, h: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:${w}px;height:${h}px;background:transparent;overflow:hidden}</style></head><body></body></html>`;
}
