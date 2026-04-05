// GET  /api/commercial/projects/[id]/slides        — ordered slide list
// POST /api/commercial/projects/[id]/slides        — add one slide at end
// POST /api/commercial/projects/[id]/slides?batch  — add N slides atomically

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const slides = await prisma.commercialSlide.findMany({
    where: { projectId: id },
    orderBy: { slideOrder: "asc" },
  });
  return NextResponse.json(slides);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ?batch=N — create N slides atomically, returning the full array.
  // Uses a transaction so all slides get unique sequential slideOrder values.
  const url = new URL(req.url);
  const batchCount = url.searchParams.has("batch")
    ? Math.min(Math.max(1, parseInt(url.searchParams.get("batch") ?? "1", 10)), 50)
    : null;

  if (batchCount !== null) {
    const slides = await prisma.$transaction(async tx => {
      const last = await tx.commercialSlide.findFirst({
        where: { projectId: id },
        orderBy: { slideOrder: "desc" },
        select: { slideOrder: true },
      });
      const base = last?.slideOrder ?? 0;
      return Promise.all(
        Array.from({ length: batchCount }, (_, i) =>
          tx.commercialSlide.create({
            data: { projectId: id, slideOrder: base + i + 1, status: "draft" },
          })
        )
      );
    });
    return NextResponse.json(slides, { status: 201 });
  }

  // Single slide creation (original behaviour)
  const last = await prisma.commercialSlide.findFirst({
    where: { projectId: id },
    orderBy: { slideOrder: "desc" },
    select: { slideOrder: true },
  });
  const nextOrder = (last?.slideOrder ?? 0) + 1;
  const slide = await prisma.commercialSlide.create({
    data: { projectId: id, slideOrder: nextOrder, status: "draft" },
  });
  return NextResponse.json(slide, { status: 201 });
}
