// GioHomeStudio — GET /api/media/[...path]
// Serves files from the local storage directory.
// Phase 1 only — replace with CDN/object storage in Phase 2.
//
// Usage: /api/media/merged/filename.mp4
//        /api/media/video/filename.mp4
//
// Security: paths are resolved relative to STORAGE_BASE_PATH and validated
// to prevent directory traversal.

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";

const STORAGE_ROOT = path.resolve(process.env.STORAGE_BASE_PATH ?? "./storage");

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".webm": "video/webm",
  ".wav": "audio/wav",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Reconstruct and resolve the full path
  const relative = segments.join("/");
  const absolute = path.resolve(STORAGE_ROOT, relative);

  // Directory traversal guard
  if (!absolute.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(absolute)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(absolute).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const stat = fs.statSync(absolute);

  const nodeStream = fs.createReadStream(absolute);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "no-cache",
      "Accept-Ranges": "bytes",
    },
  });
}
