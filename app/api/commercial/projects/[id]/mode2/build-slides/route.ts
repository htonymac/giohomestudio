// POST /api/commercial/projects/[id]/mode2/build-slides
// Called after Mode 2 script confirmation.
// Takes the file paths saved by /mode2/analyze, creates one slide per image,
// copies each file into the slide's canonical location, saves the script.
// Returns the full project (with slides) so the UI can open the editor directly.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { z } from "zod";

const schema = z.object({
  filePaths: z.array(z.string()).min(1),
  script:    z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { filePaths, script } = parsed.data;

  // Only keep paths that actually exist on disk and are images
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const validPaths = filePaths.filter(p => {
    try {
      const ext = path.extname(p).toLowerCase();
      return imageExts.has(ext) && fs.existsSync(p);
    } catch { return false; }
  });

  if (validPaths.length === 0) {
    return NextResponse.json({ error: "No valid image files found at the provided paths" }, { status: 400 });
  }

  // Delete any pre-existing draft slides (clean slate)
  await prisma.commercialSlide.deleteMany({ where: { projectId: id } });

  const slideDir = path.join(env.storagePath, "commercial", id);
  fs.mkdirSync(slideDir, { recursive: true });

  const slides = [];
  for (let i = 0; i < validPaths.length; i++) {
    const src = validPaths[i];
    const ext = path.extname(src).toLowerCase();

    const slide = await prisma.commercialSlide.create({
      data: { projectId: id, slideOrder: i + 1, status: "draft" },
    });

    const dest = path.join(slideDir, `${slide.id}${ext}`);
    fs.copyFileSync(src, dest);

    const updated = await prisma.commercialSlide.update({
      where: { id: slide.id },
      data:  { imagePath: dest, imageFileName: path.basename(src), status: "ready" },
    });
    slides.push(updated);
  }

  // Script save and final project read can run in parallel
  const [updatedProject] = await Promise.all([
    prisma.commercialProject.findUnique({ where: { id } }),
    script?.trim()
      ? prisma.commercialProject.update({ where: { id }, data: { narrationScript: script.trim() } })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ ...updatedProject, slides }, { status: 201 });
}
