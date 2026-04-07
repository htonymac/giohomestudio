// GET /api/thumbnail?path=storage/video/xxx.mp4 — extract a frame as JPEG thumbnail
// Extracts frame at 1 second (or nearest keyframe) using FFmpeg

import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

export async function GET(req: NextRequest) {
  const videoPath = new URL(req.url).searchParams.get("path");
  if (!videoPath) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  // Resolve and validate path
  const resolved = path.resolve(videoPath);
  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Check if thumbnail already cached
  const thumbDir = path.join(env.storagePath, "thumbnails");
  fs.mkdirSync(thumbDir, { recursive: true });
  const hash = Buffer.from(resolved).toString("base64url").slice(0, 32);
  const thumbPath = path.join(thumbDir, `${hash}.jpg`);

  if (!fs.existsSync(thumbPath)) {
    try {
      await execFileAsync(env.ffmpegPath, [
        "-y", "-ss", "1", "-i", resolved,
        "-frames:v", "1", "-q:v", "4",
        "-vf", "scale=320:-1",
        thumbPath,
      ], { timeout: 10000 });
    } catch {
      // Return a 1x1 transparent pixel if extraction fails
      return new NextResponse(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), {
        headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  const buf = fs.readFileSync(thumbPath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
