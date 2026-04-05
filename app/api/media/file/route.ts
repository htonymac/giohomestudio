// GET /api/media/file?path=<absolute-path>
// Serves a single file by absolute path, validated to be within STORAGE_BASE_PATH.
// Used by the Commercial Maker to preview uploaded slide images.

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";

const STORAGE_ROOT = path.resolve(process.env.STORAGE_BASE_PATH ?? "./storage");

const MIME_TYPES: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
};

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const resolved = path.resolve(filePath);

  // Security: only serve files that are inside STORAGE_ROOT
  if (!resolved.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ext  = path.extname(resolved).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  let buf: Buffer;
  try {
    buf = fs.readFileSync(resolved);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type":  mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
