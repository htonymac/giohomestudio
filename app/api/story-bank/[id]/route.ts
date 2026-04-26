// PATCH  /api/story-bank/[id] — update idea
// DELETE /api/story-bank/[id] — delete idea

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const updateSchema = z.object({
  title:           z.string().min(1).max(200).optional(),
  body:            z.string().max(5000).optional(),
  tags:            z.string().max(500).optional(),
  rating:          z.number().int().min(0).max(5).optional(),
  mode:            z.string().max(20).nullable().optional(),
  platform:        z.string().max(20).nullable().optional(),
  status:          z.enum(["idea", "scripted", "in_production", "used"]).optional(),
  usedInContentId: z.string().nullable().optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const updated = await db.storyIdea.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.storyIdea.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
