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

  for (const layer of canvas.layers.filter(l => l.visible).sort((a, b) => (a as { zIndex?: number }).zIndex ?? 0 - ((b as { zIndex?: number }).zIndex ?? 0))) {
    const x = layer.position.x;
    const y = layer.position.y;
    const lw = layer.size.width;
    const lh = layer.size.height;
    const opacity = layer.style.opacity ?? 1;

    if (layer.type === "image") {
      // Read image file and embed as base64
      const filePath = layer.content.replace(/^\/api\/media\//, "");
      const absPath = path.join(env.storagePath, filePath);
      if (fs.existsSync(absPath)) {
        const buf = fs.readFileSync(absPath);
        const ext = absPath.endsWith(".png") ? "png" : absPath.endsWith(".webp") ? "webp" : "jpeg";
        const b64 = buf.toString("base64");
        svgLayers.push(`<image x="${x}" y="${y}" width="${lw}" height="${lh}" opacity="${opacity}" href="data:image/${ext};base64,${b64}" preserveAspectRatio="xMidYMid meet"/>`);
      }
    } else if (layer.type === "text") {
      const fs2 = layer.style.fontSize ?? 24;
      const fw = layer.style.fontWeight ?? "normal";
      const color = layer.style.color ?? "#000";
      const align = layer.style.textAlign ?? "left";
      const textX = align === "center" ? x + lw / 2 : align === "right" ? x + lw : x;
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";

      // Background rect
      if (layer.style.bgColor) {
        const pad = layer.style.bgPadding ?? 0;
        const radius = layer.style.bgRadius ?? 0;
        svgLayers.push(`<rect x="${x - pad}" y="${y - pad}" width="${lw + pad * 2}" height="${lh + pad * 2}" rx="${radius}" fill="${layer.style.bgColor}" opacity="${opacity}"/>`);
      }

      // Escape text for SVG
      const safeText = layer.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      svgLayers.push(`<text x="${textX}" y="${y + fs2}" font-size="${fs2}" font-weight="${fw}" fill="${color}" font-family="Arial, sans-serif" text-anchor="${anchor}" opacity="${opacity}">${safeText}</text>`);

    } else if (layer.type === "whatsapp" || layer.type === "cta" || layer.type === "price") {
      const fs2 = layer.style.fontSize ?? 16;
      const fw = layer.style.fontWeight ?? "bold";
      const color = layer.style.color ?? "#fff";
      const bg = layer.style.bgColor ?? "#7c5cfc";
      const radius = layer.style.bgRadius ?? 8;
      const pad = layer.style.bgPadding ?? 8;

      svgLayers.push(`<rect x="${x}" y="${y}" width="${lw}" height="${lh}" rx="${radius}" fill="${bg}" opacity="${opacity}"/>`);

      const safeText = layer.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const prefix = layer.type === "whatsapp" ? "📱 " : "";
      svgLayers.push(`<text x="${x + lw / 2}" y="${y + lh / 2 + fs2 / 3}" font-size="${fs2}" font-weight="${fw}" fill="${color}" font-family="Arial, sans-serif" text-anchor="middle" opacity="${opacity}">${prefix}${safeText}</text>`);
    }
  }

  // Build full SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${canvas.background}"/>
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
