// GET /api/hybrid/scene-images?projectId=X&sceneId=Y
//   → reads fs.readdirSync(storagePath/scenes/projectId/sceneId)
//   → returns { files: [{filename, url, sizeKb, timestamp}] }
//   → returns { files: [] } if dir doesn't exist
//
// DELETE /api/hybrid/scene-images?file=/storage/scenes/PID/SID/filename
//   → deletes the file at the resolved local path
//   → returns { success: true }

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import * as path from "path";
import * as fs from "fs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const sceneId = searchParams.get("sceneId");

    if (!projectId || !sceneId) {
      return NextResponse.json({ error: "projectId and sceneId required" }, { status: 400 });
    }

    const dirPath = path.join(env.storagePath, "scenes", projectId, sceneId);

    if (!fs.existsSync(dirPath)) {
      return NextResponse.json({ files: [] });
    }

    const entries = fs.readdirSync(dirPath);
    const files = entries
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map(filename => {
        const filePath = path.join(dirPath, filename);
        let sizeKb = 0;
        let timestamp = 0;
        try {
          const stat = fs.statSync(filePath);
          sizeKb = Math.round(stat.size / 1024);
          timestamp = stat.mtimeMs;
        } catch {
          // best effort
        }
        return {
          filename,
          // FIX 6 (2026-05-22): return /api/media/ URL not /storage/ so previews + assembly work
          url: `/api/media/scenes/${projectId}/${sceneId}/${filename}`,
          sizeKb,
          timestamp,
        };
      })
      // Sort newest first
      .sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list scene images" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("file");

    if (!fileUrl) {
      return NextResponse.json({ error: "file query param required" }, { status: 400 });
    }

    // Resolve /storage/... URL to absolute path
    let localPath: string;
    if (fileUrl.startsWith("/storage/")) {
      localPath = path.join(env.storagePath, fileUrl.replace("/storage/", ""));
    } else if (fileUrl.startsWith("/api/media/")) {
      localPath = path.join(env.storagePath, fileUrl.replace("/api/media/", ""));
    } else {
      return NextResponse.json({ error: "Invalid file URL — must start with /storage/ or /api/media/" }, { status: 400 });
    }

    // Security: ensure the resolved path is under storagePath (path traversal guard)
    const resolved = path.resolve(localPath);
    const storageResolved = path.resolve(env.storagePath);
    if (!resolved.startsWith(storageResolved)) {
      return NextResponse.json({ error: "Path traversal denied" }, { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    fs.unlinkSync(resolved);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete scene image" },
      { status: 500 }
    );
  }
}
