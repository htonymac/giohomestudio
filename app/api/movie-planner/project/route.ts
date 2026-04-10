// GET  /api/movie-planner/project — list all movie projects
// POST /api/movie-planner/project — create or update a movie project with scenes

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.movieProject.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, genre: true, style: true, format: true,
        status: true, estimatedCredits: true, createdAt: true, updatedAt: true,
        _count: { select: { scenes: true } },
      },
    });
    return NextResponse.json({ projects });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const projectData = {
      title: body.title ?? "Untitled Movie",
      idea: body.idea ?? "",
      expandedStory: body.expandedStory ?? null,
      genre: body.genre ?? null,
      style: body.style ?? null,
      format: body.format ?? null,
      productionMode: body.productionMode ?? null,
      planningDepth: body.planningDepth ?? "smart",
      tone: body.tone ?? null,
      setting: body.setting ?? null,
      duration: body.duration ?? "10 min",
      language: body.language ?? "English",
      summary: body.summary ?? null,
      storyArc: body.storyArc ? (body.storyArc as Prisma.InputJsonValue) : Prisma.JsonNull,
      soundPlan: body.soundPlan ?? null,
      musicDirection: body.musicDirection ?? null,
      visualDirection: body.visualDirection ?? null,
      continuityNotes: body.continuityNotes ? (body.continuityNotes as Prisma.InputJsonValue) : Prisma.JsonNull,
      missingAssets: body.missingAssets ? (body.missingAssets as Prisma.InputJsonValue) : Prisma.JsonNull,
      reviewerNotes: body.reviewerNotes ? (body.reviewerNotes as Prisma.InputJsonValue) : Prisma.JsonNull,
      estimatedCredits: body.estimatedCredits ?? 0,
      status: body.status ?? "DRAFT",
      cast: body.cast ? (body.cast as Prisma.InputJsonValue) : Prisma.JsonNull,
    };

    let project;
    if (body.id) {
      project = await prisma.movieProject.update({ where: { id: body.id }, data: projectData });
      // Replace all scenes
      await prisma.movieScene.deleteMany({ where: { projectId: body.id } });
    } else {
      project = await prisma.movieProject.create({ data: projectData });
    }

    // Insert scenes
    if (body.scenes?.length > 0) {
      await prisma.movieScene.createMany({
        data: body.scenes.map((s: Record<string, unknown>) => ({
          projectId: project.id,
          scene: s.scene as number,
          title: (s.title as string) ?? "",
          goal: s.goal as string ?? null,
          duration: s.duration as string ?? null,
          characters: s.characters ? (s.characters as Prisma.InputJsonValue) : Prisma.JsonNull,
          visualDescription: s.visualDescription as string ?? null,
          cameraDirection: s.cameraDirection as string ?? null,
          dialogue: s.dialogue as string ?? null,
          soundEffects: s.soundEffects as string ?? null,
          ambience: s.ambience as string ?? null,
          musicCue: s.musicCue as string ?? null,
          generationMethod: s.generationMethod as string ?? null,
          costLabel: s.costLabel as string ?? null,
          status: (s.status as string) ?? "planned",
          generatedAssetUrl: s.generatedAssetUrl as string ?? null,
          generatedAudioUrl: s.generatedAudioUrl as string ?? null,
        })),
      });
    }

    const full = await prisma.movieProject.findUnique({
      where: { id: project.id },
      include: { scenes: { orderBy: { scene: "asc" } } },
    });

    return NextResponse.json({ project: full });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
