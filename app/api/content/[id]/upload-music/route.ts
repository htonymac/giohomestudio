import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { mergeMedia } from "@/modules/ffmpeg";
import { updateContentItem } from "@/modules/content-registry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.endsWith(".wav") ? ".wav" : ".mp3";
  const musicFileName = `music_upload_${id}_${Date.now()}${ext}`;
  const musicDir = path.join(env.storagePath, "music");
  if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });
  const musicPath = path.join(musicDir, musicFileName);

  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(musicPath, Buffer.from(arrayBuffer));

  await updateContentItem(id, { musicPath, musicSource: "uploaded", musicProvider: "manual" });

  // Re-merge
  if (item.videoPath) {
    const mergedFileName = `merged_${id}_${Date.now()}.mp4`;
    const mergeResult = await mergeMedia({
      videoPath: item.videoPath,
      voicePath: item.voicePath ?? null,
      musicPath,
      outputFileName: mergedFileName,
      musicVolume: item.musicVolume ?? undefined,
      voiceVolume: item.narrationVolume ?? undefined,
    });
    if (mergeResult.success) {
      await updateContentItem(id, { mergedOutputPath: mergeResult.outputPath });
      return NextResponse.json({ success: true, musicPath, mergedOutputPath: mergeResult.outputPath });
    }
  }

  return NextResponse.json({ success: true, musicPath });
}
