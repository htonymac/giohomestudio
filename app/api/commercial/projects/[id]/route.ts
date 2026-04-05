// GET    /api/commercial/projects/[id]  — project with all slides
// PATCH  /api/commercial/projects/[id]  — update project settings
// DELETE /api/commercial/projects/[id]  — delete project + cascade slides

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  projectName:          z.string().min(1).max(120).optional(),
  aspectRatio:          z.enum(["9:16", "16:9", "1:1"]).optional(),
  brandName:            z.string().max(100).nullable().optional(),
  tagline:              z.string().max(200).nullable().optional(),
  colorAccent:          z.string().max(20).nullable().optional(),
  ctaMethod:            z.enum(["whatsapp", "call", "telegram"]).nullable().optional(),
  ctaValue:             z.string().max(200).nullable().optional(),
  ctaValueSecondary:    z.string().max(200).nullable().optional(),
  ctaLabel:             z.string().max(100).nullable().optional(),
  musicSource:          z.string().nullable().optional(),
  musicVolume:          z.number().min(0).max(1).optional(),
  narrationVolume:      z.number().min(0).max(2).optional(),
  narrationScript:      z.string().nullable().optional(),
  enhancementPreset:    z.string().nullable().optional(),
  enhancementLevel:     z.number().int().min(1).max(100).nullable().optional(),
  destinationPageId:    z.string().nullable().optional(),
  voiceId:              z.string().max(100).nullable().optional(),
  voiceLanguage:        z.string().max(20).nullable().optional(),
  targetDurationSec:    z.number().int().min(5).max(600).nullable().optional(),
  autoDistribute:       z.boolean().optional(),
  captionMaxWords:      z.number().int().min(1).max(50).optional(),
  captionMaxChars:      z.number().int().min(5).max(300).nullable().optional(),
  transitionType:        z.enum(["none", "fade", "slide-left", "slide-right", "zoom-in"]).nullable().optional(),
  transitionDurationSec: z.number().min(0.1).max(2).nullable().optional(),
  globalCaptionPosition: z.enum(["top", "center", "bottom"]).nullable().optional(),
}).strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.commercialProject.findUnique({
    where: { id },
    include: { slides: { orderBy: { slideOrder: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Include mergedOutputPath from the linked ContentItem so the frontend doesn't need a second fetch.
  let mergedOutputPath: string | null = null;
  let renderStatus = project.renderStatus;
  if (project.contentItemId) {
    const ci = await prisma.contentItem.findUnique({
      where: { id: project.contentItemId },
      select: { mergedOutputPath: true, status: true },
    });
    mergedOutputPath = ci?.mergedOutputPath ?? null;
    // Auto-heal: if the project is stuck "rendering" but the content item is already
    // IN_REVIEW with a merged file, the final DB write in renderCommercial was lost.
    if (renderStatus === "rendering" && ci?.status === "IN_REVIEW" && mergedOutputPath) {
      await prisma.commercialProject.update({ where: { id }, data: { renderStatus: "ready" } });
      renderStatus = "ready";
    }
  }
  // Fetch new fields via raw query (Prisma runtime may not know them yet)
  let captionMaxWords = 8;
  let captionMaxChars: number | null = null;
  let transitionType: string | null = null;
  let transitionDurationSec: number | null = null;
  let globalCaptionPosition: string | null = null;
  try {
    const caps = await prisma.$queryRaw<Array<{
      captionMaxWords: number | null;
      captionMaxChars: number | null;
      transitionType: string | null;
      transitionDurationSec: number | null;
      globalCaptionPosition: string | null;
    }>>`
      SELECT "captionMaxWords", "captionMaxChars", "transitionType", "transitionDurationSec", "globalCaptionPosition"
      FROM commercial_projects WHERE id = ${id} LIMIT 1
    `;
    if (caps[0]) {
      captionMaxWords      = caps[0].captionMaxWords      ?? 8;
      captionMaxChars      = caps[0].captionMaxChars      ?? null;
      transitionType       = caps[0].transitionType       ?? null;
      transitionDurationSec = caps[0].transitionDurationSec ?? null;
      globalCaptionPosition = caps[0].globalCaptionPosition ?? null;
    }
  } catch { /* columns may not exist yet */ }

  return NextResponse.json({ ...project, renderStatus, mergedOutputPath, captionMaxWords, captionMaxChars, transitionType, transitionDurationSec, globalCaptionPosition });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  // Split fields: known-to-runtime fields via Prisma ORM; new fields via raw SQL
  // until `prisma generate` can be run with the server stopped.
  const { captionMaxWords, captionMaxChars, transitionType, transitionDurationSec, globalCaptionPosition, ...ormData } = parsed.data as typeof parsed.data & {
    captionMaxWords?: number;
    captionMaxChars?: number | null;
    transitionType?: string | null;
    transitionDurationSec?: number | null;
    globalCaptionPosition?: string | null;
  };

  const project = await prisma.commercialProject.update({
    where: { id },
    data: ormData,
  });

  // Save raw-SQL fields in one query when any are present
  const rawFields: string[] = [];
  const rawVals: unknown[] = [];
  if (captionMaxWords !== undefined)       { rawFields.push(`"captionMaxWords" = $${rawFields.length + 1}`);       rawVals.push(captionMaxWords); }
  if (captionMaxChars !== undefined)       { rawFields.push(`"captionMaxChars" = $${rawFields.length + 1}`);       rawVals.push(captionMaxChars); }
  if (transitionType !== undefined)        { rawFields.push(`"transitionType" = $${rawFields.length + 1}`);        rawVals.push(transitionType); }
  if (transitionDurationSec !== undefined) { rawFields.push(`"transitionDurationSec" = $${rawFields.length + 1}`); rawVals.push(transitionDurationSec); }
  if (globalCaptionPosition !== undefined) { rawFields.push(`"globalCaptionPosition" = $${rawFields.length + 1}`); rawVals.push(globalCaptionPosition); }

  if (rawFields.length > 0) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE commercial_projects SET ${rawFields.join(", ")} WHERE id = $${rawFields.length + 1}`,
        ...rawVals,
        id
      );
    } catch {
      // Non-fatal — columns may not exist yet on first deploy
    }
  }

  return NextResponse.json({
    ...project,
    captionMaxWords:       captionMaxWords       ?? project.captionMaxWords  ?? 8,
    captionMaxChars:       captionMaxChars       ?? project.captionMaxChars  ?? null,
    transitionType:        transitionType        ?? null,
    transitionDurationSec: transitionDurationSec ?? null,
    globalCaptionPosition: globalCaptionPosition ?? null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.commercialProject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
