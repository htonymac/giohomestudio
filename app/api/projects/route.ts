// GET /api/projects — list all saved editor projects
// POST /api/projects — save a project (assembly JSON + metadata)
// DELETE /api/projects?id=X&mode=editor|forever — archive or delete

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.editorProject.findMany({
    where: { status: { not: "archived" } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      segmentCount: true,
      totalDuration: true,
      creationMode: true,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      scenes: p.segmentCount,
      duration: p.totalDuration,
      creationMode: p.creationMode,
      thumbnailUrl: p.thumbnailUrl,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      status: p.status,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, title, assembly, type, status } = body;

  const segmentCount = assembly?.segments?.length || 0;
  const totalDuration = assembly?.totalDuration || 0;
  const creationMode = assembly?.creationMode || null;

  if (id) {
    // Try update existing
    const existing = await prisma.editorProject.findUnique({ where: { id } });
    if (existing) {
      await prisma.editorProject.update({
        where: { id },
        data: {
          title: title || assembly?.title || existing.title,
          type: type || existing.type,
          status: status || existing.status,
          assembly: assembly || existing.assembly,
          segmentCount,
          totalDuration,
          creationMode,
        },
      });
      return NextResponse.json({ id, saved: true });
    }
  }

  // Create new
  const project = await prisma.editorProject.create({
    data: {
      id: id || undefined,
      title: title || assembly?.title || "Untitled",
      type: type || "collaborative",
      status: status || "draft",
      assembly: assembly || {},
      segmentCount,
      totalDuration,
      creationMode,
    },
  });

  return NextResponse.json({ id: project.id, saved: true });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const mode = url.searchParams.get("mode") || "editor";

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const existing = await prisma.editorProject.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (mode === "forever") {
    await prisma.editorProject.delete({ where: { id } });
    return NextResponse.json({ deleted: true, mode: "forever" });
  } else {
    await prisma.editorProject.update({
      where: { id },
      data: { status: "archived" },
    });
    return NextResponse.json({ deleted: true, mode: "editor", archived: true });
  }
}
