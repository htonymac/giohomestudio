// GET  /api/ad-editor/project — list all ad projects (summary only)
// POST /api/ad-editor/project — create or update a project (with layers)

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.adProject.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        canvasWidth: true,
        canvasHeight: true,
        background: true,
        backgroundFinish: true,
        gradient: true,
        templateId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { layers: true } },
      },
    });
    return NextResponse.json({ projects });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface LayerInput {
  id?: string;
  type: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  content: string;
  style: Record<string, unknown>;
}

interface ProjectBody {
  id?: string;          // if provided, update existing project
  name?: string;
  type?: string;
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  backgroundFinish: string;
  gradient?: string | null;
  templateId?: string | null;
  layers: LayerInput[];
}

export async function POST(req: NextRequest) {
  try {
    const body: ProjectBody = await req.json();

    const projectData = {
      name: body.name ?? "Untitled Ad",
      type: (body.type as "AD" | "BANNER" | "FLYER" | "MOVIE_POSTER" | "EVENT") ?? "AD",
      canvasWidth: body.canvasWidth,
      canvasHeight: body.canvasHeight,
      background: body.background,
      backgroundFinish: body.backgroundFinish,
      gradient: body.gradient ?? null,
      templateId: body.templateId ?? null,
    };

    let project;

    if (body.id) {
      // Update existing project
      project = await prisma.adProject.update({
        where: { id: body.id },
        data: projectData,
      });

      // Replace all layers (delete old, insert new)
      await prisma.adLayer.deleteMany({ where: { projectId: body.id } });
    } else {
      // Create new project
      project = await prisma.adProject.create({ data: projectData });
    }

    // Insert layers
    if (body.layers.length > 0) {
      await prisma.adLayer.createMany({
        data: body.layers.map((l) => ({
          id: l.id || undefined,
          projectId: project.id,
          type: l.type,
          positionX: l.positionX,
          positionY: l.positionY,
          width: l.width,
          height: l.height,
          rotation: l.rotation,
          zIndex: l.zIndex,
          locked: l.locked,
          visible: l.visible,
          content: l.content,
          style: l.style as Prisma.InputJsonValue,
        })),
      });
    }

    // Return full project with layers
    const full = await prisma.adProject.findUnique({
      where: { id: project.id },
      include: { layers: { orderBy: { zIndex: "asc" } } },
    });

    return NextResponse.json({ project: full });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
