// POST /api/ad-editor/export — renders ad canvas to PNG or JPG using sharp
// Accepts { canvas: CanvasState, format: "png" | "jpg" }
// Returns the rendered image as binary response

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

interface LayerStyle {
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;
  bgColor?: string;
  bgPadding?: number;
  bgRadius?: number;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  shadow?: boolean;
  fontFamily?: string;
}

interface AdLayer {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  content: string;
  style: LayerStyle;
}

interface CanvasState {
  width: number;
  height: number;
  background: string;
  backgroundFinish: string;
  layers: AdLayer[];
}

// --- helpers ---

/** Escape XML special chars so SVG text nodes are valid. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Strip leading emoji clusters (Unicode category So/Sm) + trailing space from a string.
 * Catches common prefixes like "📱 ", "✅ ", etc. without touching real content.
 */
function stripEmojiPrefix(s: string): string {
  // Remove one or more emoji (broad Unicode range) followed by optional whitespace at the start
  return s.replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]+\s*/u, "");
}

/**
 * Build a font-family string from a layer style, with Arial fallback.
 */
function buildFontFamily(style: LayerStyle): string {
  const ff = style.fontFamily?.trim();
  if (!ff) return "Arial, sans-serif";
  // Already contains a comma-separated list? Keep it but ensure fallback.
  if (ff.includes(",")) return `${ff}, Arial, sans-serif`;
  // Single family name — quote if contains spaces
  const quoted = ff.includes(" ") ? `"${ff}"` : ff;
  return `${quoted}, Arial, sans-serif`;
}

/**
 * Word-wrap text to fit within `maxWidth` pixels given `fontSize`.
 * Returns an array of line strings.
 * Approximation: 1 char ≈ fontSize * 0.55 px (average for proportional fonts).
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.55;
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If single word is longer than maxChars, force it on its own line
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

/**
 * Emit SVG <tspan> elements for word-wrapped lines.
 * @param lines     — array of text lines
 * @param x         — x anchor (already computed for alignment)
 * @param startY    — y of the first baseline
 * @param lineHeight — dy between lines (typically fontSize * 1.25)
 * @param anchor    — SVG text-anchor value
 */
function buildTspans(
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  anchor: string
): string {
  return lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");
}

/**
 * Fetch an external image URL and return a data URI string, or null on failure.
 */
async function fetchExternalImage(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "image/jpeg";
    const mime = ct.split(";")[0].trim();
    const buf = Buffer.from(await resp.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// --- main handler ---

export async function POST(req: NextRequest) {
  let body: { canvas: CanvasState; format: "png" | "jpg" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { canvas, format } = body;
  if (!canvas) return NextResponse.json({ error: "Missing canvas" }, { status: 400 });

  const w = Math.min(canvas.width, 4096);
  const h = Math.min(canvas.height, 4096);

  // Build SVG representation of the canvas
  const svgLayers: string[] = [];
  // Collect per-layer filter defs (shadow filters)
  const filterDefs: string[] = [];

  const visibleLayers = canvas.layers
    .filter(l => l.visible)
    .sort((a, b) => (a as { zIndex?: number }).zIndex ?? 0 - ((b as { zIndex?: number }).zIndex ?? 0));

  for (const layer of visibleLayers) {
    const x = layer.position.x;
    const y = layer.position.y;
    const lw = layer.size.width;
    const lh = layer.size.height;
    const opacity = layer.style.opacity ?? 1;

    if (layer.type === "image") {
      // FIX 3: handle both local /api/media/... paths AND external http(s) URLs
      let dataUri: string | null = null;
      let ext = "jpeg";

      if (layer.content.startsWith("http://") || layer.content.startsWith("https://")) {
        // External URL — fetch server-side and embed as base64
        dataUri = await fetchExternalImage(layer.content);
      } else {
        // Local file via storagePath
        const filePath = layer.content.replace(/^\/api\/media\//, "");
        const absPath = path.join(env.storagePath, filePath);
        if (fs.existsSync(absPath)) {
          const buf = fs.readFileSync(absPath);
          ext = absPath.endsWith(".png") ? "png" : absPath.endsWith(".webp") ? "webp" : "jpeg";
          dataUri = `data:image/${ext};base64,${buf.toString("base64")}`;
        }
      }

      if (dataUri) {
        svgLayers.push(
          `<image x="${x}" y="${y}" width="${lw}" height="${lh}" opacity="${opacity}" href="${dataUri}" preserveAspectRatio="xMidYMid meet"/>`
        );
      }

    } else if (layer.type === "text") {
      const fontSize = layer.style.fontSize ?? 24;
      const fw = layer.style.fontWeight ?? "normal";
      const color = layer.style.color ?? "#000";
      const align = layer.style.textAlign ?? "left";
      const fontFamily = buildFontFamily(layer.style); // FIX 1
      const hasShadow = layer.style.shadow === true;   // FIX 5

      // FIX 5: shadow filter def
      let filterAttr = "";
      if (hasShadow) {
        const filterId = `shadow_${layer.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
        filterDefs.push(
          `<filter id="${filterId}" x="-10%" y="-10%" width="120%" height="140%">` +
          `<feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/>` +
          `</filter>`
        );
        filterAttr = ` filter="url(#${filterId})"`;
      }

      // FIX 2: word-wrap + tspan
      const textX = align === "center" ? x + lw / 2 : align === "right" ? x + lw : x;
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const lineHeight = fontSize * 1.25;
      const lines = wrapText(layer.content, lw, fontSize);
      // Vertically center block: offset startY so block sits in the top portion of the layer
      const startY = y + fontSize; // first baseline
      const tspans = buildTspans(lines, textX, startY, lineHeight, anchor);

      // Background rect
      if (layer.style.bgColor) {
        const pad = layer.style.bgPadding ?? 0;
        const radius = layer.style.bgRadius ?? 0;
        svgLayers.push(
          `<rect x="${x - pad}" y="${y - pad}" width="${lw + pad * 2}" height="${lh + pad * 2}" rx="${radius}" fill="${layer.style.bgColor}" opacity="${opacity}"/>`
        );
      }

      svgLayers.push(
        `<text x="${textX}" y="${startY}" font-size="${fontSize}" font-weight="${fw}" fill="${color}" font-family="${fontFamily}" text-anchor="${anchor}" opacity="${opacity}"${filterAttr}>${tspans}</text>`
      );

    } else if (layer.type === "whatsapp" || layer.type === "cta" || layer.type === "price") {
      const fontSize = layer.style.fontSize ?? 16;
      const fw = layer.style.fontWeight ?? "bold";
      const color = layer.style.color ?? "#fff";
      const bg = layer.style.bgColor ?? "#7c5cfc";
      const radius = layer.style.bgRadius ?? 8;
      const fontFamily = buildFontFamily(layer.style); // FIX 1
      const hasShadow = layer.style.shadow === true;   // FIX 5

      // FIX 4: replace emoji prefix with plain text label for whatsapp type
      let rawContent = layer.content;
      if (layer.type === "whatsapp") {
        // Strip any existing emoji prefix first, then prepend clean label
        rawContent = "WhatsApp: " + stripEmojiPrefix(layer.content);
      }

      // FIX 5: shadow filter def
      let filterAttr = "";
      if (hasShadow) {
        const filterId = `shadow_${layer.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
        filterDefs.push(
          `<filter id="${filterId}" x="-10%" y="-10%" width="120%" height="140%">` +
          `<feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.55)"/>` +
          `</filter>`
        );
        filterAttr = ` filter="url(#${filterId})"`;
      }

      svgLayers.push(
        `<rect x="${x}" y="${y}" width="${lw}" height="${lh}" rx="${radius}" fill="${bg}" opacity="${opacity}"/>`
      );

      // FIX 2: word-wrap for cta/price/whatsapp too
      const align = layer.style.textAlign ?? "center";
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const textX = align === "center" ? x + lw / 2 : align === "right" ? x + lw : x;
      const lineHeight = fontSize * 1.25;
      const lines = wrapText(rawContent, lw, fontSize);
      // Vertically center the block within the button
      const totalTextHeight = lines.length * lineHeight;
      const startY = y + lh / 2 - totalTextHeight / 2 + fontSize * 0.85;
      const tspans = buildTspans(lines, textX, startY, lineHeight, anchor);

      svgLayers.push(
        `<text x="${textX}" y="${startY}" font-size="${fontSize}" font-weight="${fw}" fill="${color}" font-family="${fontFamily}" text-anchor="${anchor}" opacity="${opacity}"${filterAttr}>${tspans}</text>`
      );
    }
  }

  // Build background layer — handle 3 forms: solid color, CSS gradient, or url(image)
  const bg = (canvas.background ?? "#FFFFFF").trim();
  let bgSvg = "";
  let defs = "";

  if (bg.startsWith("url(")) {
    // Embed the referenced image as base64 so the SVG is self-contained for sharp
    const rawUrl = bg.slice(4, -1).replace(/^["']|["']$/g, "");
    const relPath = rawUrl.replace(/^\/api\/media\//, "");
    const absPath = path.join(env.storagePath, relPath);
    if (fs.existsSync(absPath)) {
      const buf = fs.readFileSync(absPath);
      const ext = absPath.toLowerCase().endsWith(".png") ? "png" : absPath.toLowerCase().endsWith(".webp") ? "webp" : "jpeg";
      const b64 = buf.toString("base64");
      bgSvg = `<image x="0" y="0" width="${w}" height="${h}" href="data:image/${ext};base64,${b64}" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      bgSvg = `<rect width="${w}" height="${h}" fill="#FFFFFF"/>`;
    }
  } else if (bg.startsWith("linear-gradient") || bg.startsWith("radial-gradient") || bg.startsWith("conic-gradient")) {
    // Simple gradient support: parse "linear-gradient(deg, colorA, colorB)" only
    const m = bg.match(/linear-gradient\(([^,]+),\s*([^,]+)(?:,\s*([^)]+))?\)/);
    if (m) {
      const angle = m[1].trim();
      const stops = [m[2], m[3]].filter(Boolean).map(s => s?.trim() ?? "");
      const deg = parseFloat(angle) || 0;
      const rad = (deg - 90) * Math.PI / 180;
      const x1 = 50 + Math.cos(rad) * 50, y1 = 50 + Math.sin(rad) * 50;
      const x2 = 50 - Math.cos(rad) * 50, y2 = 50 - Math.sin(rad) * 50;
      defs = `<defs><linearGradient id="bgGrad" x1="${x2}%" y1="${y2}%" x2="${x1}%" y2="${y1}%">` +
        stops.map((s, i) => `<stop offset="${i * 100 / Math.max(1, stops.length - 1)}%" stop-color="${s}"/>`).join("") +
        `</linearGradient></defs>`;
      bgSvg = `<rect width="${w}" height="${h}" fill="url(#bgGrad)"/>`;
    } else {
      bgSvg = `<rect width="${w}" height="${h}" fill="#FFFFFF"/>`;
    }
  } else {
    bgSvg = `<rect width="${w}" height="${h}" fill="${bg}"/>`;
  }

  // Merge all defs (gradient + shadow filters)
  const allFilterDefs = filterDefs.length
    ? `<filter id="__unused__"></filter>` // placeholder keeps structure; real filters below
    : "";

  // Build full SVG — defs block contains gradient (if any) + all shadow filters
  let defsBlock = "";
  if (defs || filterDefs.length) {
    // Extract inner content from existing defs string, merge with filter defs
    const innerDefs = defs
      ? defs.replace(/^<defs>/, "").replace(/<\/defs>$/, "")
      : "";
    defsBlock = `<defs>${innerDefs}${filterDefs.join("")}</defs>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${defsBlock}
  ${bgSvg}
  ${svgLayers.join("\n  ")}
</svg>`;

  // Try to use sharp for rasterization, fallback to SVG
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(Buffer.from(svg))
      .resize(w, h)
      [format === "jpg" ? "jpeg" : "png"]({ quality: format === "jpg" ? 92 : undefined })
      .toBuffer();

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": format === "jpg" ? "image/jpeg" : "image/png",
        "Content-Disposition": `attachment; filename="ad_export.${format}"`,
      },
    });
  } catch {
    // Fallback: return SVG
    return new NextResponse(new Uint8Array(Buffer.from(svg)), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="ad_export.svg"`,
      },
    });
  }
}
