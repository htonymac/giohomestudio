// POST /api/commercial/projects/[id]/slides/[slideId]/rotate
// Rotates the slide's image 90° clockwise (FFmpeg transpose=1) and rewrites it to a
// versioned path so the browser re-fetches (cache-bust). Disk-based like the upload route;
// commercial images live on local disk and serve via /api/media/file (R2 disk-fallback).

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;

  const slide = await prisma.commercialSlide.findUnique({
    where: { id: slideId },
    select: { id: true, projectId: true, imagePath: true },
  });
  if (!slide || slide.projectId !== id) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }
  if (!slide.imagePath || !fs.existsSync(slide.imagePath)) {
    return NextResponse.json({ error: "No image on this slide" }, { status: 400 });
  }

  const ext = path.extname(slide.imagePath) || ".jpg";
  const dir = path.join(env.storagePath, "commercial", id);
  fs.mkdirSync(dir, { recursive: true });
  const newPath = path.join(dir, `${slideId}_r${Date.now()}${ext}`);

  try {
    // transpose=1 = rotate 90° clockwise; -map_metadata -1 strips EXIF; -q:v 2 = high quality.
    await execFileAsync(env.ffmpegPath, [
      "-y",
      "-i", slide.imagePath,
      "-vf", "transpose=1",
      "-map_metadata", "-1",
      "-q:v", "2",
      newPath,
    ]);
  } catch (err) {
    console.warn(`[rotate:${slideId}] FFmpeg rotate failed:`, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Rotate failed" }, { status: 500 });
  }

  // Best-effort delete of the old file (skip if same path somehow).
  if (slide.imagePath !== newPath) {
    try { fs.unlinkSync(slide.imagePath); } catch { /* ignore */ }
  }

  const updated = await prisma.commercialSlide.update({
    where: { id: slideId },
    data: { imagePath: newPath },
  });

  return NextResponse.json({ imagePath: updated.imagePath });
}
