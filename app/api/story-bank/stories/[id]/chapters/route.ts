// POST /api/story-bank/stories/[id]/chapters
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { title, summary, orderIndex } = await req.json();
    if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
    const cid = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await prisma.$executeRaw`
      INSERT INTO chapters (id, "storyId", title, summary, "orderIndex", "createdAt", "updatedAt")
      VALUES (${cid}, ${id}, ${title}, ${summary || null}, ${orderIndex ?? 0}, NOW(), NOW())
    `;
    return NextResponse.json({ ok: true, id: cid });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}
