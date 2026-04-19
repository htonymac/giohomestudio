// POST /api/stickers/render
// Accepts a sticker definition and returns an SVG string suitable for
// embedding in video overlays or passing to FFmpeg via Sharp.
// Request:  { type, color, width, height, strokeWidth }
// Response: { svg: string }

import { NextRequest, NextResponse } from "next/server";

type StickerType =
  | "circle"
  | "underline"
  | "arrow_right"
  | "star"
  | "checkmark"
  | "bracket"
  | "burst"
  | "spotlight";

interface RenderRequest {
  type: StickerType;
  color?: string;      // hex, default "#ef4444"
  width?: number;      // px, default 400
  height?: number;     // px, default 200
  strokeWidth?: number; // default 6
}

const PATHS: Record<StickerType, { viewBox: string; path: string; fill?: boolean; dashed?: boolean }> = {
  circle: {
    viewBox: "0 0 200 100",
    path: "M 100 8 C 155 5, 192 30, 192 50 C 192 70, 158 92, 100 92 C 42 92, 8 70, 8 50 C 8 30, 45 11, 100 8 Z",
  },
  underline: {
    viewBox: "0 0 200 30",
    path: "M 5 18 Q 40 8, 80 18 Q 120 28, 160 16 Q 185 10, 195 18",
  },
  arrow_right: {
    viewBox: "0 0 185 50",
    path: "M 10 25 L 170 25 M 140 8 L 175 25 L 140 42",
  },
  star: {
    viewBox: "0 0 100 90",
    path: "M 50 5 L 61 35 L 95 35 L 67 55 L 79 85 L 50 65 L 21 85 L 33 55 L 5 35 L 39 35 Z",
    fill: true,
  },
  checkmark: {
    viewBox: "0 0 100 85",
    path: "M 5 45 L 35 75 L 95 10",
  },
  bracket: {
    viewBox: "0 0 100 100",
    path: "M 30 10 L 10 10 L 10 90 L 30 90 M 70 10 L 90 10 L 90 90 L 70 90",
  },
  burst: {
    viewBox: "0 0 100 100",
    path: "M 50 5 L 56 35 L 75 15 L 65 43 L 95 35 L 72 55 L 95 68 L 65 62 L 73 90 L 52 70 L 50 95 L 48 70 L 27 90 L 35 62 L 5 68 L 28 55 L 5 35 L 35 43 L 25 15 L 44 35 Z",
    fill: true,
  },
  spotlight: {
    viewBox: "0 0 100 100",
    path: "M 50 10 C 72 10, 90 28, 90 50 C 90 72, 72 90, 50 90 C 28 90, 10 72, 10 50 C 10 28, 28 10, 50 10 Z",
    dashed: true,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body: RenderRequest = await req.json();
    const { type, color = "#ef4444", width = 400, height = 200, strokeWidth = 6 } = body;

    if (!type || !PATHS[type]) {
      return NextResponse.json({ error: "Invalid sticker type" }, { status: 400 });
    }

    const def = PATHS[type];
    const fillAttr = def.fill ? `${color}33` : "none";
    const dashAttr = def.dashed ? `stroke-dasharray="12 8"` : "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${def.viewBox}" fill="none">
  <path
    d="${def.path}"
    stroke="${color}"
    stroke-width="${strokeWidth}"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="${fillAttr}"
    ${dashAttr}
  />
</svg>`;

    return NextResponse.json({ svg });
  } catch (err) {
    console.error("[stickers/render]", err);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}
