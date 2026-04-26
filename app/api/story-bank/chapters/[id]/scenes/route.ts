// POST /api/story-bank/chapters/[id]/scenes
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { title, description, durationSeconds, orderIndex, notes } = await req.json();
    const sid = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await prisma.$executeRaw`
      INSERT INTO story_scenes (id, "chapterId", title, description, "durationSeconds", "orderIndex", notes, "createdAt", "updatedAt")
      VALUES (${sid}, ${id}, ${title || null}, ${description || ""}, ${durationSeconds || 5},
              ${orderIndex ?? 0}, ${notes || null}, NOW(), NOW())
    `;
    return NextResponse.json({ ok: true, id: sid });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}
