// POST /api/content/[id]/stamp-logo
// Burns the user's logo onto a finished content item's video and PERSISTS it —
// replaces the item's mergedOutputPath with the stamped video so Review, Download
// and every downstream use pick up the stamped version. Used by the LogoStampCard
// on the content review detail page.
// Body: { logoUrl, corner?, scale?, opacity? }  (videoUrl is ignored — we stamp
// the item's own mergedOutputPath, the source of truth.)

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { updateContentItem } from "@/modules/content-registry";
import { resolveVideoPath } from "@/lib/resolve-video-path";
import { stampLogoOnVideo, StampCorner } from "@/lib/brand-stamp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { logoUrl, corner, scale, opacity } = await req.json() as {
      logoUrl?: string; corner?: string; scale?: number; opacity?: number;
    };
    if (!logoUrl) return NextResponse.json({ error: "logoUrl required — upload a logo first" }, { status: 400 });

    const item = await prisma.contentItem.findUnique({ where: { id }, select: { id: true, mergedOutputPath: true } });
    if (!item) return NextResponse.json({ error: "Content item not found" }, { status: 404 });
    if (!item.mergedOutputPath) return NextResponse.json({ error: "This item has no finished video yet" }, { status: 400 });

    const videoPath = resolveVideoPath(item.mergedOutputPath) ?? (fs.existsSync(item.mergedOutputPath) ? item.mergedOutputPath : null);
    if (!videoPath) return NextResponse.json({ error: "Finished video file is missing" }, { status: 404 });

    const logoPath = resolveVideoPath(logoUrl);
    if (!logoPath || !fs.existsSync(logoPath)) return NextResponse.json({ error: `Logo not found: ${logoUrl}` }, { status: 404 });

    const valid: StampCorner[] = ["br", "bl", "tr", "tl", "center"];
    const useCorner = (valid as string[]).includes(corner || "") ? (corner as StampCorner) : "br";

    const outPath = await stampLogoOnVideo(videoPath, logoPath, {
      corner: useCorner,
      scale: typeof scale === "number" ? scale : undefined,
      opacity: typeof opacity === "number" ? opacity : undefined,
    });

    // Persist so Review / Download / publish all use the stamped video.
    await updateContentItem(id, { mergedOutputPath: outPath });

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${path.basename(outPath)}` });
  } catch (err) {
    console.error("[content/stamp-logo]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
