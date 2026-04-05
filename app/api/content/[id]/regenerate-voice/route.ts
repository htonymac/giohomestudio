import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as path from "path";
import { env } from "@/config/env";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
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

  const narrationText = body.narrationScript ?? item.narrationScript ?? item.originalInput;
  const voiceId = body.voiceId ?? item.voiceId ?? undefined;
  const voiceLanguage = body.voiceLanguage ?? item.voiceLanguage ?? undefined;
  const narrationSpeed = body.narrationSpeed ?? item.narrationSpeed ?? undefined;

  const voiceFileName = `voice_${id}_${Date.now()}.mp3`;
  const voicePath = path.join(env.storagePath, "voice", voiceFileName);

  const provider = env.elevenlabs.apiKey ? elevenLabsVoiceProvider : mockVoiceProvider;
  const result = await provider.generate({
    text: narrationText,
    voiceId,
    language: voiceLanguage,
    speed: narrationSpeed ?? undefined,
    outputPath: voicePath,
  });

  if (result.status === "failed") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await updateContentItem(id, {
    voicePath: result.localPath,
    voiceProvider: provider.name,
    voiceSource: "generated",
    narrationScript: narrationText,
    voiceId: voiceId ?? undefined,
    voiceLanguage: voiceLanguage ?? undefined,
  });

  // Re-merge if video exists
  if (item.videoPath) {
    const mergedFileName = `merged_${id}_${Date.now()}.mp4`;
    const mergeResult = await mergeMedia({
      videoPath: item.videoPath,
      voicePath: result.localPath ?? null,
      musicPath: item.musicPath ?? null,
      outputFileName: mergedFileName,
      musicVolume: item.musicVolume ?? undefined,
      voiceVolume: item.narrationVolume ?? undefined,
    });
    if (mergeResult.success) {
      await updateContentItem(id, { mergedOutputPath: mergeResult.outputPath });
      return NextResponse.json({ success: true, voicePath: result.localPath, mergedOutputPath: mergeResult.outputPath });
    }
  }

  return NextResponse.json({ success: true, voicePath: result.localPath });
}
