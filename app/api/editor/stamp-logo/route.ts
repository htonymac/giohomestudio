// POST /api/editor/stamp-logo
// Burns the user's own brand logo into a video, small and in one corner
// (default bottom-right, Kling-style — visible but never blocking the shot).
// Body: { videoUrl, logoUrl, corner?: "br"|"bl"|"tr"|"tl"|"center",
//         scale?: 0.03..0.6 (fraction of video width), opacity?: 0.05..1 }
// Returns: { ok, outputUrl } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { resolveVideoPath } from "@/lib/resolve-video-path";
import { stampLogoOnVideo, StampCorner } from "@/lib/brand-stamp";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, logoUrl, corner, scale, opacity } = await req.json() as {
      videoUrl?: string; logoUrl?: string;
      corner?: string; scale?: number; opacity?: number;
    };

    if (!videoUrl) return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
    if (!logoUrl) return NextResponse.json({ error: "logoUrl required — upload a logo first" }, { status: 400 });

    const videoPath = resolveVideoPath(videoUrl);
    if (!videoPath || !fs.existsSync(videoPath)) {
      return NextResponse.json({ error: `Video not found: ${videoUrl}` }, { status: 404 });
    }
    const logoPath = resolveVideoPath(logoUrl);
    if (!logoPath || !fs.existsSync(logoPath)) {
      return NextResponse.json({ error: `Logo not found: ${logoUrl}` }, { status: 404 });
    }

    const validCorners: StampCorner[] = ["br", "bl", "tr", "tl", "center"];
    const useCorner = (validCorners as string[]).includes(corner || "") ? (corner as StampCorner) : "br";

    const outPath = await stampLogoOnVideo(videoPath, logoPath, {
      corner: useCorner,
      scale: typeof scale === "number" ? scale : undefined,
      opacity: typeof opacity === "number" ? opacity : undefined,
    });

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${path.basename(outPath)}` });
  } catch (err) {
    console.error("[editor/stamp-logo]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
