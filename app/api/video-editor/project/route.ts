// GET  /api/video-editor/project — list all video editor projects (summary only)
// POST /api/video-editor/project — create or update a project (full state blob)

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.videoEditorProject.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ projects });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface ProjectBody {
  id?: string;          // if provided, update existing project
  name?: string;
  state: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body: ProjectBody = await req.json();

    const projectData = {
      name: body.name ?? "Untitled video project",
      state: body.state as Prisma.InputJsonValue,
    };

    let project;

    if (body.id) {
      // Update existing project
      project = await prisma.videoEditorProject.update({
        where: { id: body.id },
        data: projectData,
      });
    } else {
      // Create new project
      project = await prisma.videoEditorProject.create({ data: projectData });
    }

    return NextResponse.json({ id: project.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
