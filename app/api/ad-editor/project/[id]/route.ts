// GET    /api/ad-editor/project/[id] — load a project with all layers
// DELETE /api/ad-editor/project/[id] — delete a project and its layers/assets/jobs

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.adProject.findUnique({
      where: { id },
      include: {
        layers: { orderBy: { zIndex: "asc" } },
        assets: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Cascade delete handles layers, assets, and aiJobs
    await prisma.adProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
