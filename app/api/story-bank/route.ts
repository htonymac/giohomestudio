// GET  /api/story-bank — list all story ideas
// POST /api/story-bank — create a new idea

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const createSchema = z.object({
  title:    z.string().min(1).max(200),
  body:     z.string().max(5000).optional(),
  tags:     z.string().max(500).optional(),
  rating:   z.number().int().min(0).max(5).optional(),
  mode:     z.string().max(20).optional(),
  platform: z.string().max(20).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? undefined;
  const search   = searchParams.get("search") ?? undefined;
  const sortBy   = searchParams.get("sort") ?? "createdAt";
  const sortDir  = searchParams.get("dir") === "asc" ? "asc" : "desc";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) where.title = { contains: search, mode: "insensitive" };

  const items = await db.storyIdea.findMany({
    where,
    orderBy: sortBy === "rating" ? { rating: sortDir } : { createdAt: sortDir },
    take: 100,
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const idea = await db.storyIdea.create({ data: parsed.data });
  return NextResponse.json(idea, { status: 201 });
}
