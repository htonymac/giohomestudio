// Caption Compositor — HTML builder
// Produces a complete self-contained HTML string that Playwright can render to a
// transparent-background PNG.  All text is CSS-constrained to safe zones —
// no text can overflow outside the frame boundary.

import { PRESETS } from "./presets";
import type { CaptionRenderInput, CaptionPosition, AspectRatio } from "./types";
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
  // "custom" cards are absolutely placed, so layer flex is irrelevant.
  return "flex-end";
}

function buildGradient(gradient: string, pos: CaptionPosition): string {
  if (pos === "top") return gradient.replace("to top", "to bottom");
  if (pos === "center") return "rgba(0,0,0,0.78)";
  return gradient;
}

export function buildCaptionHtml(input: CaptionRenderInput): string {
  const { text, position, preset: presetName, fontOverride, aspectRatio, fontSizeScale = 1.0 } = input;
  const preset  = PRESETS[presetName] ?? PRESETS.realEstate;
  const scale   = Math.max(0.3, Math.min(2.0, fontSizeScale));
  const { w, h } = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];
  const { headline, sublines } = parseLines(text);

  if (!headline) return buildEmptyHtml(w, h);

  const rawStack   = fontOverride ? `"${fontOverride}", ${preset.fontStack}` : preset.fontStack;
  // Insert the colour-emoji font BEFORE the generic family. Anything after a
  // generic (sans-serif/serif/monospace) is never reached, so without this the
  // browser hits the generic — which has no colour emoji — and burns tofu (▢)
  // boxes where the user typed 📞 / 🎬 etc. Requires Noto Color Emoji installed
  // on the render host (it is, on the Linux server).
  const fontStack  = /(?:sans-serif|serif|monospace)\s*$/i.test(rawStack)
    ? rawStack.replace(/(sans-serif|serif|monospace)\s*$/i, '"Noto Color Emoji", $1')
    : `${rawStack}, "Noto Color Emoji"`;
  const justify    = justifyContent(position);
  const gradient   = buildGradient(preset.gradient, position);

  // Custom = free-placed box at (x,y)% of the frame (drag/custom). Otherwise a
  // full-width banner at top/center/bottom.
  const custom = position === "custom";
  const cx = Math.max(0, Math.min(100, input.x ?? 50));
  const cy = Math.max(0, Math.min(100, input.y ?? 85));

  // For center: symmetric vertical padding; for top/bottom: asymmetric
  const padTop    = position === "center" ? 28 : position === "top" ? preset.padBottom : preset.padTop;
  const padBottom = position === "center" ? 28 : position === "top" ? preset.padTop    : preset.padBottom;

  // Custom card is a centred, rounded box floated at (cx,cy); banner is edge-to-edge.
  // Fixed 82% width (not auto) so the text uses the room and reads like the banner
  // instead of shrinking to a cramped, over-wrapped little box.
  const cardLayout = custom
    ? `position: absolute; left: ${cx}%; top: ${cy}%; transform: translate(-50%, -50%);
       width: 82%; border-radius: 16px; text-align: center;`
    : ``;
  const cardBg = custom ? "rgba(0,0,0,0.55)" : gradient;

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
    background: ${cardBg};
    padding: ${padTop}px ${preset.padSide}px ${padBottom}px;
    max-height: ${preset.maxCardHeight};
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: ${preset.blockGap}px;
    flex-shrink: 0;
    ${cardLayout}
  }
  .hl {
    font-family: ${fontStack};
    font-size: ${Math.round(preset.headlineSize * scale)}px;
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
    font-size: ${Math.round(preset.sublineSize * scale)}px;
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

/**
 * Builds a narration subtitle HTML — small text strip at the very bottom of the frame.
 * Designed to show the voiceover/narration line as a subtitle on the video.
 */
export function buildNarrationHtml(text: string, aspectRatio: AspectRatio): string {
  const { w, h } = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];
  const cleaned = text.replace(/\n/g, " ").trim();
  if (!cleaned) return buildEmptyHtml(w, h);

  // Font size scales with width so it's readable at any ratio
  const fontSize = Math.round(w * 0.032);

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
  .sub-strip {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: ${Math.round(h * 0.012)}px ${Math.round(w * 0.05)}px ${Math.round(h * 0.018)}px;
    background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 60%, transparent 100%);
    font-family: "Arial", "Helvetica", "Noto Color Emoji", sans-serif;
    font-size: ${fontSize}px;
    font-weight: 500;
    color: #F0F0F0;
    line-height: 1.4;
    text-align: center;
    word-break: break-word;
    text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7);
  }
</style>
</head>
<body>
  <div class="sub-strip">${escapeHtml(cleaned)}</div>
</body>
</html>`;
}
