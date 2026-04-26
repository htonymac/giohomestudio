// GioHomeStudio — POST /api/overlays/render
// Applies overlay layers to the full video of a ContentItem and updates the record.

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { applyOverlays, type OverlayLayer } from "@/modules/ffmpeg/overlay";
import { getContentItem, updateContentItem } from "@/modules/content-registry";

export async function POST(req: NextRequest) {
  let body: { contentItemId?: string; layers?: OverlayLayer[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contentItemId, layers } = body;
  if (!contentItemId || !layers) {
    return NextResponse.json({ error: "Missing required fields: contentItemId, layers" }, { status: 400 });
  }

  const item = await getContentItem(contentItemId);
  if (!item) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  }

  const sourceVideo = item.mergedOutputPath ?? item.videoPath;
  if (!sourceVideo) {
    return NextResponse.json({ error: "Content item has no video output to overlay" }, { status: 400 });
  }

  const outputDir = path.resolve(path.dirname(sourceVideo));
  const outputPath = path.join(outputDir, `video_overlay_${Date.now()}.mp4`);

  try {
    const result = await applyOverlays({ videoPath: sourceVideo, layers, outputPath });
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "FFmpeg overlay failed" }, { status: 500 });
    }

    await updateContentItem(contentItemId, {
      mergedOutputPath: result.outputPath,
      overlayLayers: layers,
    });

    return NextResponse.json({
      contentItemId,
      outputPath: result.outputPath,
      layerCount: layers.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
