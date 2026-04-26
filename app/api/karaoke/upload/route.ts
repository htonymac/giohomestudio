// POST /api/karaoke/upload
// Accepts multipart/form-data with field "file" (audio file)
// Saves to storage/karaoke/<uuid>.<ext>
// Creates KaraokeRecording row in DB
// Returns: { recordingId, fileUrl, fileName }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALLOWED_EXTS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided. Send field name: file" }, { status: 400 });
    }

    // Size check
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: `File too large. Max 50 MB. Got ${(file.size / 1024 / 1024).toFixed(1)} MB` }, { status: 400 });
    }

    // Extension check
    const origName = file.name || "recording.webm";
    const ext = path.extname(origName).toLowerCase() || ".webm";
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `Unsupported format: ${ext}. Allowed: mp3, wav, m4a, aac, ogg, webm` }, { status: 400 });
    }

    // Save file
    const id = uuidv4();
    const fileName = `${id}${ext}`;
    const karaokeDir = path.join(env.storagePath, "karaoke");
    fs.mkdirSync(karaokeDir, { recursive: true });
    const filePath = path.join(karaokeDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/api/media/karaoke/${fileName}`;

    // Persist to DB
    const userId = (formData.get("userId") as string) || "anonymous";
    const recording = await prisma.karaokeRecording.create({
      data: {
        id,
        userId,
        fileUrl,
        fileName: origName,
      },
    });

    return NextResponse.json({
      recordingId: recording.id,
      fileUrl: recording.fileUrl,
      fileName: recording.fileName,
    });
  } catch (err) {
    console.error("[karaoke/upload] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
