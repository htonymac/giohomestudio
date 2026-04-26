// PUT/DELETE /api/story-bank/chapters/[id]
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { title, summary, orderIndex } = await req.json();
    await prisma.$executeRaw`
      UPDATE chapters SET
        title = COALESCE(${title || null}, title),
        summary = COALESCE(${summary || null}, summary),
        "orderIndex" = COALESCE(${orderIndex ?? null}::int, "orderIndex"),
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
    await prisma.$executeRaw`DELETE FROM chapters WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}
