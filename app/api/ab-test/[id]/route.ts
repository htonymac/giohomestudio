// PATCH  /api/ab-test/[id] — update test or variant metrics
// DELETE /api/ab-test/[id] — delete test

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const updateSchema = z.object({
  status: z.enum(["active", "paused", "completed"]).optional(),
  winnerVariantId: z.string().optional(),
  // Update a specific variant's metrics
  variantId: z.string().optional(),
  views: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  engagement: z.number().min(0).max(100).optional(),
  isWinner: z.boolean().optional(),
  postUrl: z.string().optional(),
  platform: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { variantId, views, clicks, engagement, isWinner, postUrl, platform, ...testUpdate } = parsed.data;

  // Update variant if variantId provided
  if (variantId) {
    const data: Record<string, unknown> = {};
    if (views !== undefined) data.views = views;
    if (clicks !== undefined) data.clicks = clicks;
    if (engagement !== undefined) data.engagement = engagement;
    if (isWinner !== undefined) data.isWinner = isWinner;
    if (postUrl) data.postUrl = postUrl;
    if (platform) data.platform = platform;
    await db.aBVariant.update({ where: { id: variantId }, data });
  }

  // Update test if test-level fields provided
  if (testUpdate.status || testUpdate.winnerVariantId) {
    await db.aBTest.update({ where: { id }, data: testUpdate });
  }

  const test = await db.aBTest.findUnique({ where: { id }, include: { variants: true } });
  return NextResponse.json(test);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.aBTest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
