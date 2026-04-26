// GET  /api/story-bank/stories        — list all stories
// POST /api/story-bank/stories        — create story
// Uses raw SQL (Prisma client DLL locked by dev server)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string; title: string; genre: string | null; tone: string | null;
      logline: string | null; targetDurationSeconds: number; status: string;
      createdAt: Date; updatedAt: Date;
    }>>`SELECT id, title, genre, tone, logline, "targetDurationSeconds", status, "createdAt", "updatedAt"
        FROM stories ORDER BY "updatedAt" DESC`;
    return NextResponse.json({ stories: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, genre, tone, logline, targetDurationSeconds } = await req.json();
    if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

    const id = `story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await prisma.$executeRaw`
      INSERT INTO stories (id, title, genre, tone, logline, "targetDurationSeconds", status, "createdAt", "updatedAt")
      VALUES (${id}, ${title}, ${genre || null}, ${tone || null}, ${logline || null},
              ${targetDurationSeconds || 0}, 'draft', NOW(), NOW())
    `;
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}
