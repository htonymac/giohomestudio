// GET  /api/commercial/projects  — list all projects
// POST /api/commercial/projects  — create a new commercial project

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  projectName:  z.string().min(1).max(120),
  aspectRatio:  z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  brandName:    z.string().max(100).optional(),
  tagline:      z.string().max(200).optional(),
  destinationPageId: z.string().optional(),
});

export async function GET() {
  const projects = await prisma.commercialProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: { slides: { select: { id: true, status: true, imagePath: true } } },
  });

  // For "ready" projects, find the rendered video from ContentItem
  const enriched = await Promise.all(projects.map(async (p) => {
    let renderedVideoPath: string | null = null;
    if (p.renderStatus === "ready" && p.contentItemId) {
      try {
        const content = await prisma.contentItem.findUnique({
          where: { id: p.contentItemId },
          select: { mergedOutputPath: true },
        });
        renderedVideoPath = content?.mergedOutputPath ?? null;
      } catch { /* ignore */ }
    }
    return { ...p, renderedVideoPath };
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const project = await prisma.commercialProject.create({ data: parsed.data });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/commercial/projects]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
