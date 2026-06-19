// POST /api/upload/video — Upload a video file to storage
// Returns { url, filePath, duration } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";
import { execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|mkv)$/i)) {
      return NextResponse.json({ error: "Invalid video format. Use MP4, MOV, or WebM." }, { status: 400 });
    }

    // Save file
    const uploadDir = path.join(env.storagePath, "video", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const ext = path.extname(file.name) || ".mp4";
    const fileName = `upload_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeMedia(filePath, buffer);

    // Get duration via ffprobe
    let duration = 0;
    try {
      const { stdout } = await execAsync(env.ffmpegPath.replace("ffmpeg", "ffprobe"), [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", filePath,
      ], { timeout: 10000 });
      duration = parseFloat(stdout.trim()) || 0;
    } catch { /* ffprobe not available */ }

    const url = `/api/media/video/uploads/${fileName}`;

    // Auto-save to asset library
    try {
      const assetFile = path.join(env.storagePath, "config", "asset-library.json");
      let assets: Array<Record<string, unknown>> = [];
      try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
      assets.unshift({
        id: `upload_${Date.now()}`,
        type: "video",
        name: file.name,
        description: `Uploaded video — ${Math.round(duration)}s`,
        filePath,
        tags: ["video", "uploaded"],
        source: "uploaded",
        createdAt: new Date().toISOString(),
      });
      fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
    } catch { /* best effort */ }

    return NextResponse.json({
      url,
      filePath,
      duration: Math.round(duration * 100) / 100,
      fileName: file.name,
      size: file.size,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
