// PATCH /api/free-mode/messages/[id] — update scenes JSON for an assistant message
// Body: { scenes: Scene[] }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "message id required" }, { status: 400 });
    }

    const body = await req.json();
    const { scenes } = body as { scenes?: unknown };

    if (!Array.isArray(scenes)) {
      return NextResponse.json({ error: "scenes array required" }, { status: 400 });
    }

    const updated = await prisma.freeModeMessage.update({
      where: { id },
      data:  { scenes: scenes as object[] },
    });

    // Bump session updatedAt so it floats to top of history
    await prisma.freeModeSession.update({
      where: { id: updated.sessionId },
      data:  { updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
