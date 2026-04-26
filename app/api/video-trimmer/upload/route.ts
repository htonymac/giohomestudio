// GioHomeStudio — POST /api/video-trimmer/upload
// Accepts a video file, saves to temp storage, extracts metadata via ffprobe.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { probeVideo } from "@/modules/ffmpeg/trim-plan";
import { ALLOWED_VIDEO_MIME, sanitizeFilename } from "@/lib/media-utils";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 });
  }

  const file = form.get("video") as File | null;
  if (!file) return NextResponse.json({ error: "No video file provided" }, { status: 400 });
  if (!ALLOWED_VIDEO_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported format. Use MP4, MOV, WEBM, AVI or MKV." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum 500 MB." }, { status: 400 });
  }

  const uploadDir = path.join(env.storagePath, "uploads", "trimmer");
  fs.mkdirSync(uploadDir, { recursive: true });

  const safeName = sanitizeFilename(file.name);
  const tempPath = path.join(uploadDir, `${Date.now()}_${safeName}`);

  await fs.promises.writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

  try {
    const metadata = await probeVideo(tempPath);
    return NextResponse.json({ tempPath, metadata });
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `ffprobe failed: ${message}` }, { status: 500 });
  }
}
