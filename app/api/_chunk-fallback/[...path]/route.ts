// GET /api/_chunk-fallback/<filename> — serve a Next.js static chunk that
// the built-in /_next/static/chunks/... handler returned 404 for.
//
// Henry 2026-06-01: Next.js v16 + Turbopack on this codebase produces one
// 291KB chunk for children-planner that exists on disk but the built-in
// static handler refuses to serve (returns 404 with 9-byte body). All other
// chunks for the same route serve fine. Cause is unclear — possibly a size
// gate or manifest mismatch in Turbopack v16. Fix is a fallback rewrite in
// next.config.ts that retries the URL via this route when the original 404s.
// This route reads the file directly from .next/static/chunks/ and ships it.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  const filename = parts.join("/");
  if (filename.includes("..") || filename.includes("\\") || filename.startsWith("/")) {
    return new NextResponse("Bad request", { status: 400 });
  }
  const filepath = path.join(process.cwd(), ".next", "static", "chunks", filename);
  if (!fs.existsSync(filepath)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const buf = fs.readFileSync(filepath);
  return new NextResponse(buf, {
    headers: {
      "content-type": filename.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
