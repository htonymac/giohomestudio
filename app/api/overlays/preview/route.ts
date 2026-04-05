// GioHomeStudio — POST /api/overlays/preview
// Renders a 3-second preview clip with overlay layers applied. Returns preview URL.

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";
import { applyOverlays, type OverlayLayer } from "@/modules/ffmpeg/overlay";

export async function POST(req: NextRequest) {
  let body: { videoPath?: string; layers?: OverlayLayer[]; startSec?: number; durationSec?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { videoPath, layers, startSec = 2, durationSec = 3 } = body;
  if (!videoPath || !layers) {
    return NextResponse.json({ error: "Missing required fields: videoPath, layers" }, { status: 400 });
  }

  const timestamp = Date.now();
  const outputPath = path.resolve(`storage/previews/overlay_preview_${timestamp}.mp4`);

  try {
    const result = await applyOverlays({ videoPath, layers, outputPath, startSec, durationSec });
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "FFmpeg failed" }, { status: 500 });
    }

    // Auto-clean preview file after 60 seconds
    setTimeout(() => { try { fs.unlinkSync(outputPath); } catch { /* ignore */ } }, 60_000);

    const relPath = outputPath.replace(/\\/g, "/").replace(/.*storage\//, "");
    return NextResponse.json({ previewUrl: `/api/media/${relPath}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
