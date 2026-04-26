// PUT/DELETE /api/story-bank/scenes/[id]
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { title, description, durationSeconds, orderIndex, notes } = await req.json();
    await prisma.$executeRaw`
      UPDATE story_scenes SET
        title = COALESCE(${title || null}, title),
        description = COALESCE(${description || null}, description),
        "durationSeconds" = COALESCE(${durationSeconds ?? null}::int, "durationSeconds"),
        "orderIndex" = COALESCE(${orderIndex ?? null}::int, "orderIndex"),
        notes = COALESCE(${notes || null}, notes),
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.$executeRaw`DELETE FROM story_scenes WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}
