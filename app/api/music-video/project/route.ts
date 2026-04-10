// GET  /api/music-video/project — list music video projects
// POST /api/music-video/project — save/update project

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.musicVideoProject.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ projects });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = {
      title: body.title ?? "Untitled Music Video",
      songTitle: body.songTitle ?? null,
      songUrl: body.songUrl ?? null,
      lyrics: body.lyrics ?? null,
      videoMode: body.videoMode ?? null,
      visualStyle: body.visualStyle ?? null,
      artistName: body.artistName ?? null,
      status: body.status ?? "draft",
      musicProfile: body.musicProfile ? (body.musicProfile as Prisma.InputJsonValue) : Prisma.JsonNull,
      storyboard: body.storyboard ? (body.storyboard as Prisma.InputJsonValue) : Prisma.JsonNull,
      motionboard: body.motionboard ? (body.motionboard as Prisma.InputJsonValue) : Prisma.JsonNull,
      recommendations: body.recommendations ? (body.recommendations as Prisma.InputJsonValue) : Prisma.JsonNull,
      renderedVideoUrl: body.renderedVideoUrl ?? null,
    };

    let project;
    if (body.id) {
      project = await prisma.musicVideoProject.update({ where: { id: body.id }, data });
    } else {
      project = await prisma.musicVideoProject.create({ data });
    }
    return NextResponse.json({ project });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
