// PATCH  /api/free-mode/history/[id]  — update status / result
// DELETE /api/free-mode/history/[id]  — remove item

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.freeModeHistory.update({
      where: { id },
      data: {
        ...(body.status        !== undefined && { status:        String(body.status) }),
        ...(body.resultUrl     !== undefined && { resultUrl:     body.resultUrl ? String(body.resultUrl) : null }),
        ...(body.errorMsg      !== undefined && { errorMsg:      body.errorMsg ? String(body.errorMsg) : null }),
        ...(body.contentItemId !== undefined && { contentItemId: body.contentItemId ? String(body.contentItemId) : null }),
        ...(body.resultType    !== undefined && { resultType:    String(body.resultType) }),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.freeModeHistory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
