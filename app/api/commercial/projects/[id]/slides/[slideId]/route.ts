// PATCH  /api/commercial/projects/[id]/slides/[slideId]  — update slide fields
// DELETE /api/commercial/projects/[id]/slides/[slideId]  — remove slide + reorder

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  captionOriginal:     z.string().max(500).nullable().optional(),
  captionPolished:     z.string().max(500).nullable().optional(),
  captionApproved:     z.boolean().optional(),
  narrationLine:       z.string().max(500).nullable().optional(),
  durationMs:          z.number().int().min(500).max(30000).optional(),
  brandingEnabled:     z.boolean().optional(),
  enhancementSettings: z.record(z.unknown()).nullable().optional(),
  slideOrder:          z.number().int().min(1).optional(),
  imagePath:           z.null().optional(),  // only null is accepted — clears the image
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { slideId } = await params;
  const body   = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { enhancementSettings, imagePath, ...rest } = parsed.data;

  // When imagePath: null is sent, delete the image file and reset status to draft.
  const imageUpdate: Record<string, unknown> = {};
  if (imagePath === null) {
    const current = await prisma.commercialSlide.findUnique({ where: { id: slideId }, select: { imagePath: true } });
    if (current?.imagePath) {
      try { fs.unlinkSync(current.imagePath); } catch { /* file already gone */ }
    }
    imageUpdate.imagePath     = null;
    imageUpdate.imageFileName = null;
    imageUpdate.status        = "draft";
  }

  const slide = await prisma.commercialSlide.update({
    where: { id: slideId },
    data: {
      ...rest,
      ...imageUpdate,
      ...(enhancementSettings !== undefined
        ? { enhancementSettings: enhancementSettings === null ? Prisma.JsonNull : (enhancementSettings as Prisma.InputJsonValue) }
        : {}),
    },
  });
  return NextResponse.json(slide);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  const deleted = await prisma.commercialSlide.delete({ where: { id: slideId } });

  // Shift all slides that came after the deleted one down by 1
  await prisma.commercialSlide.updateMany({
    where: { projectId: id, slideOrder: { gt: deleted.slideOrder } },
    data: { slideOrder: { decrement: 1 } },
  });

  return NextResponse.json({ ok: true, deletedSlideOrder: deleted.slideOrder });
}
