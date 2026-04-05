// POST /api/commercial/projects/[id]/slides/reorder
// Body: { order: string[] }  — full ordered array of slide IDs
// Assigns slideOrder 1..N based on the array position, in a transaction.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  order: z.array(z.string()).min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { order } = parsed.data;

  // Verify all slide IDs belong to this project
  const slides = await prisma.commercialSlide.findMany({
    where: { projectId: id },
    select: { id: true },
  });
  const validIds = new Set(slides.map(s => s.id));
  if (order.some(sid => !validIds.has(sid)) || order.length !== slides.length) {
    return NextResponse.json({ error: "Invalid slide IDs" }, { status: 400 });
  }

  // Update all slideOrders in a transaction
  await prisma.$transaction(
    order.map((slideId, index) =>
      prisma.commercialSlide.update({
        where: { id: slideId },
        data: { slideOrder: index + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
