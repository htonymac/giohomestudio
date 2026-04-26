// POST /api/video-tools/trim
// Accepts a video file (multipart) + startSec + endSec.
// Trims using FFmpeg stream-copy and creates a ContentItem in Review.
// Returns { contentItemId }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { trimVideo } from "@/modules/ffmpeg";
import { createContentItem, updateContentItem } from "@/modules/content-registry";

const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file     = form.get("file") as File | null;
  const startRaw = form.get("startSec");
  const endRaw   = form.get("endSec");

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported format. Use MP4, MOV, WEBM or AVI." }, { status: 400 });
  }

  const startSec = parseFloat(String(startRaw ?? "0"));
  const endSec   = parseFloat(String(endRaw ?? "0"));
  if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) {
    return NextResponse.json({ error: "endSec must be greater than startSec" }, { status: 400 });
  }

  const uploadDir = path.join(env.storagePath, "video-tools", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const ext       = file.name.split(".").pop() ?? "mp4";
  const inputPath = path.join(uploadDir, `trim_src_${Date.now()}.${ext}`);
  fs.writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

  let item: Awaited<ReturnType<typeof createContentItem>>;
  try {
    item = await createContentItem({
      originalInput:   `Trim: ${file.name} (${startSec}s → ${endSec}s)`,
      mode:            "FREE",
      outputMode:      "video_to_video",
      audioMode:       "voice_music",
      durationSeconds: Math.ceil(endSec - startSec),
      aiAutoMode:      false,
    });
  } catch (err) {
    fs.unlinkSync(inputPath);
    throw err;
  }

  (async () => {
    try {
      await updateContentItem(item.id, { status: "GENERATING_VIDEO" });
      const outPath = path.join(env.storagePath, "video-tools", "trimmed", `trimmed_${item.id}.mp4`);
      const result  = await trimVideo(inputPath, outPath, startSec, endSec);
      if (!result.success || !result.outputPath) throw new Error(result.error ?? "Trim failed");
      await updateContentItem(item.id, {
        status:           "IN_REVIEW",
        videoPath:        result.outputPath,
        mergedOutputPath: result.outputPath,
      });
    } catch (err) {
      await updateContentItem(item.id, { status: "FAILED", notes: String(err) });
    } finally {
      try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
    }
  })();

  return NextResponse.json(
    { contentItemId: item.id, message: `Trimming ${file.name} (${startSec}s → ${endSec}s). Check Review when ready.` },
    { status: 202 }
  );
}
