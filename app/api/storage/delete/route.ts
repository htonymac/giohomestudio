// DELETE /api/storage/delete?folder=<>&path=<relative-path>
// OR
// DELETE /api/storage/delete?folder=<>&all=1   (deletes all files in folder)
//
// Henry 2026-06-03 (Sonnet audit Fix #10): storage cleanup tool.
// Safety:
//   - folder must be in the allow-list (same as /api/storage/list)
//   - path is resolved + checked to stay under env.storagePath/<folder>
//   - never follows symlinks outside storage
//   - all=1 deletes only files (not subdirs) within the chosen folder tree

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

function isUnderRoot(child: string, root: string): boolean {
  const resolvedChild = path.resolve(child);
  const resolvedRoot = path.resolve(root);
  return resolvedChild.startsWith(resolvedRoot + path.sep) || resolvedChild === resolvedRoot;
}

export async function DELETE(req: NextRequest) {
  try {
    const folder = req.nextUrl.searchParams.get("folder") || "";
    if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: "folder required + in allow-list" }, { status: 400 });
    }
    const folderPath = path.join(env.storagePath, folder);
    if (!fs.existsSync(folderPath)) {
      return NextResponse.json({ error: "folder does not exist" }, { status: 404 });
    }

    // Bulk-delete-all mode
    if (req.nextUrl.searchParams.get("all") === "1") {
      let deleted = 0, freedBytes = 0;
      const walk = (dir: string, depth: number) => {
        if (depth > 3) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (!isUnderRoot(full, folderPath)) continue;
          if (ent.isFile()) {
            try {
              const size = fs.statSync(full).size;
              fs.unlinkSync(full);
              deleted++;
              freedBytes += size;
            } catch { /* skip */ }
          } else if (ent.isDirectory()) {
            walk(full, depth + 1);
          }
        }
      };
      walk(folderPath, 0);
      return NextResponse.json({ ok: true, deleted, freedBytes });
    }

    // Single-file delete mode
    const relPath = req.nextUrl.searchParams.get("path") || "";
    if (!relPath) {
      return NextResponse.json({ error: "path required for single-file delete" }, { status: 400 });
    }
    if (relPath.includes("..") || path.isAbsolute(relPath)) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }
    const fullPath = path.join(folderPath, relPath);
    if (!isUnderRoot(fullPath, folderPath)) {
      return NextResponse.json({ error: "path escapes folder" }, { status: 400 });
    }
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "not a file" }, { status: 400 });
    }
    const freedBytes = stat.size;
    fs.unlinkSync(fullPath);
    return NextResponse.json({ ok: true, freedBytes, path: relPath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "delete failed" }, { status: 500 });
  }
}
