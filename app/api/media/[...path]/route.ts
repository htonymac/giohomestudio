// GioHomeStudio — GET /api/media/[...path]
// Serves files from the local storage directory with HTTP Range request support.
// Range support is required for browsers to seek/stream MP4 video correctly.

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";

const STORAGE_ROOT = path.resolve(process.env.STORAGE_BASE_PATH ?? "./storage");

const MIME_TYPES: Record<string, string> = {
  ".mp4":  "video/mp4",
  ".mp3":  "audio/mpeg",
  ".webm": "video/webm",
  ".wav":  "audio/wav",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".gif":  "image/gif",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  const relative = segments.join("/");
  const absolute = path.resolve(STORAGE_ROOT, relative);

  if (!absolute.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(absolute)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(absolute).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const { size } = fs.statSync(absolute);

  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    // Parse "bytes=start-end"
    const [, rangeValue] = rangeHeader.split("=");
    const [startStr, endStr] = (rangeValue ?? "").split("-");
    const start = parseInt(startStr, 10) || 0;
    const end   = endStr ? parseInt(endStr, 10) : size - 1;
    const chunkSize = end - start + 1;

    const nodeStream = fs.createReadStream(absolute, { start, end });
    const webStream  = new ReadableStream({
      start(controller) {
        nodeStream.on("data",  (chunk) => controller.enqueue(chunk));
        nodeStream.on("end",   () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() { nodeStream.destroy(); },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Type":   contentType,
        "Content-Range":  `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkSize),
        "Accept-Ranges":  "bytes",
        "Cache-Control":  "no-cache",
      },
    });
  }

  // Full file response (no Range header)
  const nodeStream = fs.createReadStream(absolute);
  const webStream  = new ReadableStream({
    start(controller) {
      nodeStream.on("data",  (chunk) => controller.enqueue(chunk));
      nodeStream.on("end",   () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() { nodeStream.destroy(); },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type":   contentType,
      "Content-Length": String(size),
      "Accept-Ranges":  "bytes",
      "Cache-Control":  "no-cache",
    },
  });
}
