import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAndGenerateMusic } from "@/modules/music-provider/resolver";
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

  const mood = body.mood ?? item.musicGenre ?? "epic";
  const genre = body.genre ?? item.musicGenre ?? undefined;
  const region = body.region ?? item.musicRegion ?? undefined;

  const musicResult = await resolveAndGenerateMusic(
    { mood, genre, region, durationSeconds: item.durationSeconds ?? 30 },
    body.provider ?? "stock_library"
  );

  if (musicResult.status === "failed") {
    return NextResponse.json({ error: musicResult.error }, { status: 500 });
  }

  await updateContentItem(id, {
    musicPath: musicResult.localPath ?? undefined,
    musicProvider: musicResult.providerName,
    musicSource: "stock",
  });

  // Re-merge if video exists
  if (item.videoPath) {
    const mergedFileName = `merged_${id}_${Date.now()}.mp4`;
    const mergeResult = await mergeMedia({
      videoPath: item.videoPath,
      voicePath: item.voicePath ?? null,
      musicPath: musicResult.localPath ?? null,
      outputFileName: mergedFileName,
      musicVolume: item.musicVolume ?? undefined,
      voiceVolume: item.narrationVolume ?? undefined,
    });
    if (mergeResult.success) {
      await updateContentItem(id, { mergedOutputPath: mergeResult.outputPath });
      return NextResponse.json({ success: true, musicPath: musicResult.localPath, mergedOutputPath: mergeResult.outputPath });
    }
  }

  return NextResponse.json({ success: true, musicPath: musicResult.localPath });
}
