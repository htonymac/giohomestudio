// GioHomeStudio — POST /api/overlays/render-direct
// Applies overlay layers directly to a video file path (no ContentItem required).
// Used by the standalone Video Editor page.
//
// Request:  { videoPath: string; layers: OverlayLayer[]; title?: string }
// Response: { outputPath: string; outputUrl: string; contentItemId: string }

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";
import { applyOverlays, type OverlayLayer } from "@/modules/ffmpeg/overlay";
import { createContentItem, updateContentItem } from "@/modules/content-registry";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  let body: { videoPath?: string; layers?: OverlayLayer[]; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { videoPath, layers, title } = body;
  if (!videoPath || !layers) {
    return NextResponse.json({ error: "Missing required fields: videoPath, layers" }, { status: 400 });
  }

  const absVideoPath = path.resolve(videoPath);
  if (!fs.existsSync(absVideoPath)) {
    return NextResponse.json({ error: `Video file not found: ${absVideoPath}` }, { status: 400 });
  }

  const outputDir = path.join(env.storagePath, "outputs", "editor");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `editor_${Date.now()}.mp4`);

  // Create ContentItem to track in registry
  const item = await createContentItem({
    originalInput: title || "Video Editor export",
    mode: "FREE",
    outputMode: "video_to_video",
    aiAutoMode: false,
  });

  try {
    const result = await applyOverlays({ videoPath: absVideoPath, layers, outputPath });
    if (!result.success) {
      await updateContentItem(item.id, { status: "FAILED", notes: result.error });
      return NextResponse.json({ error: result.error ?? "FFmpeg overlay failed" }, { status: 500 });
    }

    await updateContentItem(item.id, {
      status: "IN_REVIEW",
      videoPath: result.outputPath,
      mergedOutputPath: result.outputPath,
      overlayLayers: layers,
    });

    // Build a media URL for the output
    const relPath = result.outputPath
      .replace(/\\/g, "/")
      .replace(/^.*?storage[\\/]?/, "");
    const outputUrl = `/api/media/${relPath}`;

    return NextResponse.json({
      outputPath: result.outputPath,
      outputUrl,
      contentItemId: item.id,
      layerCount: layers.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await updateContentItem(item.id, { status: "FAILED", notes: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
