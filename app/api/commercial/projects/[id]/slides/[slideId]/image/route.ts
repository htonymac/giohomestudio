// POST /api/commercial/projects/[id]/slides/[slideId]/image
// Accepts multipart/form-data with field "image" (JPG/PNG/WEBP).
// Saves to storage/commercial/[projectId]/[slideId].[ext] and updates slide record.
// Phone photos are re-encoded through FFmpeg to normalize EXIF rotation before saving.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
};

// Re-encode image through FFmpeg to bake EXIF rotation into pixels.
// Phone photos (especially portrait JPEGs) have Orientation tag but pixels stored in landscape —
// without this, images appear upside-down or sideways in the slideshow.
async function normalizeOrientation(buffer: Buffer, destPath: string): Promise<void> {
  // sharp.rotate() with NO angle auto-orients from the EXIF Orientation tag, then strips it.
  // In-process (no ffmpeg spawn) → fast upload; and it leaves already-straight images UNCHANGED
  // (no spurious rotation). Fixes "a straight image rotates itself" + "upload takes time".
  await sharp(buffer).rotate().toFile(destPath);
}

export async function POST(
  req: NextRequest,
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

  const formData = await req.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file in request" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type. Use JPEG, PNG, or WEBP." }, { status: 400 });
  }

  const ext = EXT_MAP[file.type];
  const dir = path.join(env.storagePath, "commercial", id);
  fs.mkdirSync(dir, { recursive: true });

  // Remove old image if it exists
  if (slide.imagePath && fs.existsSync(slide.imagePath)) {
    try { fs.unlinkSync(slide.imagePath); } catch { /* ignore */ }
  }

  const imagePath = path.join(dir, `${slideId}${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Auto-orient in-process via sharp (fast, no temp file, no ffmpeg spawn).
  try {
    await normalizeOrientation(buffer, imagePath);
  } catch (err) {
    console.warn(`[Image upload:${slideId}] sharp auto-orient failed — saving raw image:`, err instanceof Error ? err.message : String(err));
    await fs.promises.writeFile(imagePath, buffer);
  }

  const updated = await prisma.commercialSlide.update({
    where: { id: slideId },
    data: { imagePath, imageFileName: file.name, status: "ready" },
  });

  return NextResponse.json({ imagePath: updated.imagePath, imageFileName: updated.imageFileName });
}
