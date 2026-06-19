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
import { callLLM } from "@/lib/llm";

const schema = z.object({
  filePaths:   z.array(z.string()).min(1),
  script:      z.string().optional(),
  productName: z.string().optional(),  // passed for richer per-image captions
  productType: z.string().optional(),
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

  const { filePaths, script, productName, productType } = parsed.data;

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

  const productContext = [productName, productType].filter(Boolean).join(" — ") || "product";

  const slides = [];
  for (let i = 0; i < validPaths.length; i++) {
    const src = validPaths[i];
    const ext = path.extname(src).toLowerCase();
    const fileName = path.basename(src, ext);

    const slide = await prisma.commercialSlide.create({
      data: { projectId: id, slideOrder: i + 1, status: "draft" },
    });

    const dest = path.join(slideDir, `${slide.id}${ext}`);
    fs.copyFileSync(src, dest);

    // Generate a short per-image caption via haiku (cheap). If it fails, leave null.
    let caption: string | null = null;
    try {
      const captionResult = await callLLM(
        `Write a short, punchy ad caption (10-15 words max) for image ${i + 1} of ${validPaths.length} in a commercial for: ${productContext}. File name context: ${fileName}. Return only the caption text, no quotes.`,
        "You are a commercial copywriter. Write short, impactful ad captions for product images. Output only the caption — no quotes, no labels.",
        { role: "fast", forceModel: "claude-haiku-4-5-20251001", maxTokens: 60, temperature: 0.7, timeoutMs: 10000 }
      );
      if (captionResult.ok && captionResult.text.trim()) {
        caption = captionResult.text.trim().replace(/^["'`]+|["'`]+$/g, "");
      }
    } catch (err) {
      console.warn(`[build-slides] caption gen failed for slide ${i + 1}:`, err instanceof Error ? err.message : String(err));
    }

    const updated = await prisma.commercialSlide.update({
      where: { id: slide.id },
      data:  {
        imagePath:       dest,
        imageFileName:   path.basename(src),
        status:          "ready",
        captionOriginal: caption,
        captionPolished: caption,  // start polished = original; editor can refine later
      },
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
