// POST /api/video-tools/narrate
// Accepts a video file (multipart) + narration text (+ optional voiceId).
// Generates voice via ElevenLabs (or mock), merges over the video, creates a ContentItem.
// Returns { contentItemId }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { mergeMedia } from "@/modules/ffmpeg";
import { createContentItem, updateContentItem } from "@/modules/content-registry";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
import { loadLLMSettings } from "@/lib/llm-settings";

const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]);

export async function POST(req: NextRequest) {
  const form    = await req.formData();
  const file    = form.get("file") as File | null;
  const text    = String(form.get("text") ?? "").trim();
  const voiceId = String(form.get("voiceId") ?? "").trim() || undefined;

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported format. Use MP4, MOV, WEBM or AVI." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Narration text is required" }, { status: 400 });

  const uploadDir = path.join(env.storagePath, "video-tools", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const ext       = file.name.split(".").pop() ?? "mp4";
  const inputPath = path.join(uploadDir, `narrate_src_${Date.now()}.${ext}`);
  fs.writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

  let item: Awaited<ReturnType<typeof createContentItem>>;
  try {
    item = await createContentItem({
      originalInput:   `Narrate: ${file.name}`,
      mode:            "FREE",
      outputMode:      "video_to_video",
      audioMode:       "voice_music",
      narrationScript: text,
      voiceId,
      aiAutoMode:      false,
    });
  } catch (err) {
    fs.unlinkSync(inputPath);
    throw err;
  }

  (async () => {
    try {
      await updateContentItem(item.id, { status: "GENERATING_VOICE" });

      const elevenKey = loadLLMSettings().ELEVENLABS_API_KEY || env.elevenlabs.apiKey;
      const provider  = elevenKey ? elevenLabsVoiceProvider : mockVoiceProvider;
      const voicePath = path.join(env.storagePath, "voice", `narrate_${item.id}.mp3`);
      const voiceResult = await provider.generate({ text, outputPath: voicePath, voiceId });
      const resolvedVoicePath =
        voiceResult.status === "completed" && voiceResult.localPath ? voiceResult.localPath : null;

      await updateContentItem(item.id, {
        status: "MERGING",
        ...(resolvedVoicePath ? { voicePath: resolvedVoicePath } : {}),
      });

      // Layer narration over the original video's existing audio at reduced volume
      const mergeResult = await mergeMedia({
        videoPath:      inputPath,
        voicePath:      resolvedVoicePath,
        outputFileName: `narrated_${item.id}.mp4`,
        musicVolume:    0.7,
        voiceVolume:    1.0,
      });

      if (!mergeResult.success || !mergeResult.outputPath) {
        throw new Error(mergeResult.error ?? "Merge failed");
      }

      await updateContentItem(item.id, {
        status:           "IN_REVIEW",
        mergedOutputPath: mergeResult.outputPath,
      });
    } catch (err) {
      await updateContentItem(item.id, { status: "FAILED", notes: String(err) });
    } finally {
      try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
    }
  })();

  return NextResponse.json(
    { contentItemId: item.id, message: "Adding narration to your video. Check Review when ready." },
    { status: 202 }
  );
}
