// POST /api/commercial/projects/[id]/slides/batch-upload
// Accepts multipart/form-data with multiple "images" files.
// Creates one slide per image, normalizes EXIF, returns the updated slide list.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
};

async function normalizeOrientation(srcPath: string, destPath: string): Promise<void> {
  await execFileAsync(env.ffmpegPath, [
    "-y", "-i", srcPath, "-map_metadata", "-1", "-q:v", "2", destPath,
  ]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No image files in request" }, { status: 400 });
  }
  if (files.length > 20) {
    return NextResponse.json({ error: "Maximum 20 images per batch" }, { status: 400 });
  }

  const invalid = files.filter(f => !ALLOWED_TYPES.has(f.type));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Unsupported types: ${invalid.map(f => f.name).join(", ")}` }, { status: 400 });
  }

  // Get current highest slide order
  const lastSlide = await prisma.commercialSlide.findFirst({
    where: { projectId: id },
    orderBy: { slideOrder: "desc" },
    select: { slideOrder: true },
  });
  let nextOrder = (lastSlide?.slideOrder ?? 0) + 1;

  const dir = path.join(env.storagePath, "commercial", id);
  fs.mkdirSync(dir, { recursive: true });
  const tmpDir = path.join(env.storagePath, "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  const created = [];

  for (const file of files) {
    const ext = EXT_MAP[file.type] ?? ".jpg";
    const slideOrder = nextOrder++;

    // Create slide record first to get ID
    const slide = await prisma.commercialSlide.create({
      data: { projectId: id, slideOrder, status: "draft" },
    });

    const imagePath = path.join(dir, `${slide.id}${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());

    // Normalize EXIF orientation
    const tmpPath = path.join(tmpDir, `batch_${slide.id}_${Date.now()}${ext}`);
    try {
      await fs.promises.writeFile(tmpPath, buffer);
      await normalizeOrientation(tmpPath, imagePath);
    } catch {
      await fs.promises.writeFile(imagePath, buffer);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ok */ }
    }

    const updated = await prisma.commercialSlide.update({
      where: { id: slide.id },
      data: { imagePath, imageFileName: file.name, status: "ready" },
    });

    created.push(updated);
  }

  return NextResponse.json({ slides: created, count: created.length }, { status: 201 });
}
