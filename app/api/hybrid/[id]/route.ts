// GET /api/hybrid/:id — Load full hybrid project with all relations
// PATCH /api/hybrid/:id — Update project settings
// DELETE /api/hybrid/:id — Delete project

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.hybridProject.findUnique({
    where: { id },
    include: {
      scenes: {
        include: {
          shots: { orderBy: { orderIndex: "asc" } },
          dialogueLines: { orderBy: { orderIndex: "asc" } },
          audioPlan: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Load characters
  const characters = project.characterIds.length > 0
    ? await prisma.characterVoice.findMany({
        where: { id: { in: project.characterIds } },
      })
    : [];

  return NextResponse.json({
    project: {
      ...project,
      expandedStory: project.expandedStory,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    characters: characters.map(c => ({
      id: c.id,
      characterId: c.characterId,
      name: c.name,
      role: c.role,
      gender: c.gender,
      voiceId: c.voiceId,
      voiceName: c.voiceName,
      visualDescription: c.visualDescription,
      imageUrl: c.imageUrl,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const project = await prisma.hybridProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Only allow updating safe fields
  const updateData: Record<string, unknown> = {};
  const allowedFields = ["title", "targetDuration", "audience", "language", "costPreference", "narrationPref", "tone", "genre", "status"];
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  const updated = await prisma.hybridProject.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.hybridProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Cascade delete handles scenes, shots, dialogue, audio plans
  await prisma.hybridProject.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
