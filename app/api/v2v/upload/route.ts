// POST /api/v2v/upload
// Accepts a source video file for Video-to-Video mode.
// Saves to storage/uploads/v2v/ and returns the path for the pipeline.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { ALLOWED_VIDEO_MIME, sanitizeFilename } from "@/lib/media-utils";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_VIDEO_MIME.has(file.type)) {
    return NextResponse.json({ error: "Unsupported format. Use MP4, MOV, WEBM, AVI or MKV." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum 500 MB." }, { status: 400 });
  }

  const uploadDir = path.join(env.storagePath, "uploads", "v2v");
  fs.mkdirSync(uploadDir, { recursive: true });

  const safeName  = sanitizeFilename(file.name);
  const filePath  = path.join(uploadDir, `${Date.now()}_${safeName}`);

  await fs.promises.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ filePath, originalName: file.name, sizeBytes: file.size });
}
