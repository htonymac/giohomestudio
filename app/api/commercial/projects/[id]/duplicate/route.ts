// POST /api/commercial/projects/[id]/duplicate
// Clones a commercial project with all its slides (images, captions, settings).
// The new project starts in "draft" status with a fresh name.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const original = await prisma.commercialProject.findUnique({
    where: { id },
    include: { slides: { orderBy: { slideOrder: "asc" } } },
  });
  if (!original) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Create new project with same settings but fresh status
  const clone = await prisma.commercialProject.create({
    data: {
      projectName:       `${original.projectName} (copy)`,
      aspectRatio:       original.aspectRatio,
      brandName:         original.brandName,
      tagline:           original.tagline,
      targetDurationSec: original.targetDurationSec,
      autoDistribute:    original.autoDistribute,
      voiceId:           original.voiceId,
      voiceLanguage:     original.voiceLanguage,
      musicVolume:       original.musicVolume,
      narrationVolume:   original.narrationVolume,
      destinationPageId: original.destinationPageId,
      ctaMethod:         original.ctaMethod,
      ctaValue:          original.ctaValue,
      ctaValueSecondary: original.ctaValueSecondary,
      renderStatus:      "draft",
    },
  });

  // Clone slides with images
  const cloneDir = path.join(env.storagePath, "commercial", clone.id);
  fs.mkdirSync(cloneDir, { recursive: true });

  for (const slide of original.slides) {
    let newImagePath: string | null = null;

    // Copy image file if it exists
    if (slide.imagePath && fs.existsSync(slide.imagePath)) {
      const ext = path.extname(slide.imagePath);
      const newFileName = `${clone.id}_s${slide.slideOrder}${ext}`;
      newImagePath = path.join(cloneDir, newFileName);
      try {
        fs.copyFileSync(slide.imagePath, newImagePath);
      } catch {
        newImagePath = null;
      }
    }

    await prisma.commercialSlide.create({
      data: {
        projectId:          clone.id,
        slideOrder:         slide.slideOrder,
        imagePath:          newImagePath,
        imageFileName:      slide.imageFileName,
        captionOriginal:    slide.captionOriginal,
        captionPolished:    slide.captionPolished,
        captionApproved:    slide.captionApproved,
        narrationLine:      slide.narrationLine,
        durationMs:         slide.durationMs,
        enhancementSettings: slide.enhancementSettings ?? undefined,
        status:             newImagePath ? "ready" : "draft",
      },
    });
  }

  const result = await prisma.commercialProject.findUnique({
    where: { id: clone.id },
    include: { slides: { orderBy: { slideOrder: "asc" } } },
  });

  return NextResponse.json(result, { status: 201 });
}
