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
  const voiceFileName = `voice_upload_${id}_${Date.now()}${ext}`;
  const voiceDir = path.join(env.storagePath, "voice");
  if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });
  const voicePath = path.join(voiceDir, voiceFileName);

  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(voicePath, Buffer.from(arrayBuffer));

  await updateContentItem(id, { voicePath, voiceSource: "uploaded", voiceProvider: "manual" });

  // Re-merge
  if (item.videoPath) {
    const mergedFileName = `merged_${id}_${Date.now()}.mp4`;
    const mergeResult = await mergeMedia({
      videoPath: item.videoPath,
      voicePath,
      musicPath: item.musicPath ?? null,
      outputFileName: mergedFileName,
      musicVolume: item.musicVolume ?? undefined,
      voiceVolume: item.narrationVolume ?? undefined,
    });
    if (mergeResult.success) {
      await updateContentItem(id, { mergedOutputPath: mergeResult.outputPath });
      return NextResponse.json({ success: true, voicePath, mergedOutputPath: mergeResult.outputPath });
    }
  }

  return NextResponse.json({ success: true, voicePath });
}
