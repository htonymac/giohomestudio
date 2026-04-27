// POST /api/karaoke/from-url
// Body: { url: string, userId?: string }
// Downloads audio from URL, saves to storage/karaoke/, creates KaraokeRecording row
// Returns: { recordingId, fileUrl, fileName }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_CONTENT_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg",
  "audio/webm", "application/octet-stream",
]);

const EXT_MAP: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, userId = "anonymous" } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http/https URLs are supported" }, { status: 400 });
    }

    // Fetch URL
    const fetchResp = await fetch(url, {
      headers: { "User-Agent": "GioHomeStudio/1.0" },
    });

    if (!fetchResp.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${fetchResp.status} ${fetchResp.statusText}` }, { status: 400 });
    }

    const contentType = fetchResp.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "application/octet-stream";

    // Guess extension from URL path if content-type is generic
    let ext = EXT_MAP[contentType] || ".mp3";
    const urlPath = parsedUrl.pathname;
    const urlExt = path.extname(urlPath).toLowerCase();
    if ([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"].includes(urlExt)) {
      ext = urlExt;
    }

    // Read buffer with size check
    const buffer = await fetchResp.arrayBuffer();
    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: `File too large. Max 50 MB. Got ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB` }, { status: 400 });
    }

    // Save to disk
    const id = uuidv4();
    const fileName = `${id}${ext}`;
    const karaokeDir = path.join(env.storagePath, "karaoke");
    fs.mkdirSync(karaokeDir, { recursive: true });
    const filePath = path.join(karaokeDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const fileUrl = `/api/media/karaoke/${fileName}`;
    const origName = path.basename(urlPath) || `from-url-${id}${ext}`;

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
    console.error("[karaoke/from-url] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "URL import failed" },
      { status: 500 }
    );
  }
}
