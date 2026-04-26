import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeMedia } from "@/modules/ffmpeg";
import { updateContentItem } from "@/modules/content-registry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!item.videoPath) return NextResponse.json({ error: "No video to merge with" }, { status: 400 });

  const mergedFileName = `merged_${id}_${Date.now()}.mp4`;
  const mergeResult = await mergeMedia({
    videoPath: item.videoPath,
    voicePath: item.voicePath ?? null,
    musicPath: item.musicPath ?? null,
    outputFileName: mergedFileName,
    musicVolume: body.musicVolume ?? item.musicVolume ?? undefined,
    voiceVolume: body.voiceVolume ?? item.narrationVolume ?? undefined,
  });

  if (!mergeResult.success) {
    return NextResponse.json({ error: mergeResult.error }, { status: 500 });
  }

  await updateContentItem(id, { mergedOutputPath: mergeResult.outputPath });
  return NextResponse.json({ success: true, mergedOutputPath: mergeResult.outputPath });
}
