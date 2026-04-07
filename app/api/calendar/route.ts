// GET  /api/calendar?month=2026-04 — items for a month (created, scheduled, approved)
// PATCH /api/calendar/[id]         — set scheduledAt on a content item

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // "2026-04"

  const now = new Date();
  const year  = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.split("-")[1]) - 1 : now.getMonth();

  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 1);

  const items = await db.contentItem.findMany({
    where: {
      OR: [
        { createdAt:   { gte: start, lt: end } },
        { scheduledAt: { gte: start, lt: end } },
        { approvedAt:  { gte: start, lt: end } },
      ],
    },
    select: {
      id: true,
      originalInput: true,
      status: true,
      mode: true,
      createdAt: true,
      approvedAt: true,
      scheduledAt: true,
      publishedAt: true,
      durationSeconds: true,
      destinationPage: { select: { name: true, platform: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ items, year, month: month + 1 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id?: string; scheduledAt?: string | null };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await db.contentItem.update({
    where: { id: body.id },
    data: { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null },
  });

  return NextResponse.json({ id: updated.id, scheduledAt: updated.scheduledAt });
}
