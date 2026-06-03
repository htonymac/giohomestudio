// GET /api/storage/list?folder=<subfolder>
//
// Henry 2026-06-03 (Sonnet audit Fix #10): storage browser.
// Lists files under storage/<folder>/ with size + last-modified + ext.
// Safe: only allows reading under env.storagePath; path traversal blocked.
//
// Response: { folder: string, files: Array<{name, path, size, sizeHuman, mtime, ext}> }

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import * as fs from "fs";
import * as path from "path";

const ALLOWED_FOLDERS = [
  "audio/tts",
  "scenes/unlinked",
  "scenes/prerendered",
  "video/assembled",
  "video/temp",
  "thumbnails",
  "music",
  "characters",
  "jobs/assemble",
  "jobs/assemble/bodies",
];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export async function GET(req: NextRequest) {
  try {
    const folder = req.nextUrl.searchParams.get("folder") || "";
    if (!folder) {
      return NextResponse.json({ folders: ALLOWED_FOLDERS });
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: "folder not in allow-list" }, { status: 403 });
    }
    const fullPath = path.join(env.storagePath, folder);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json({ folder, files: [] });
    }
    // Recursive walk one level deep (most storage folders have sub-IDs).
    const out: Array<{ name: string; path: string; size: number; sizeHuman: string; mtime: number; ext: string }> = [];
    const walk = (dir: string, rel: string, depth: number) => {
      if (depth > 2) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const relPath = path.join(rel, ent.name).replace(/\\/g, "/");
        if (ent.isFile()) {
          try {
            const s = fs.statSync(full);
            out.push({
              name: ent.name,
              path: relPath,
              size: s.size,
              sizeHuman: humanSize(s.size),
              mtime: s.mtimeMs,
              ext: path.extname(ent.name).toLowerCase(),
            });
          } catch { /* skip */ }
        } else if (ent.isDirectory()) {
          walk(full, relPath, depth + 1);
        }
      }
    };
    walk(fullPath, "", 0);
    out.sort((a, b) => b.mtime - a.mtime);
    const totalSize = out.reduce((s, f) => s + f.size, 0);
    return NextResponse.json({
      folder,
      fileCount: out.length,
      totalSize,
      totalSizeHuman: humanSize(totalSize),
      files: out.slice(0, 500), // cap response size
      truncated: out.length > 500,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "storage list failed" }, { status: 500 });
  }
}
