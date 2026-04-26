// GET /api/hybrid/video-registry[?projectId=...]
// Returns the server-side map of sceneId → videoUrl.
// If projectId is provided, returns project-scoped entries (falls back to bare sceneId).

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function GET(req: NextRequest) {
  const videoDir = path.join(env.storagePath, "videos");
  const registryPath = path.join(env.storagePath, "video-registry.json");
  const projectId = req.nextUrl.searchParams.get("projectId") || null;

  // Start with whatever the registry file has
  let registry: Record<string, string> = {};
  if (fs.existsSync(registryPath)) {
    try { registry = JSON.parse(fs.readFileSync(registryPath, "utf8")); } catch { /* ignore */ }
  }

  // Also scan the videos directory to catch files not yet in the registry
  if (fs.existsSync(videoDir)) {
    const files = fs.readdirSync(videoDir).filter(f => f.match(/^scene_SC\d+_\d+\.mp4$/));
    const latest: Record<string, { ts: number; file: string }> = {};
    for (const f of files) {
      const m = f.match(/scene_(SC\d+)_(\d+)\.mp4/);
      if (m) {
        const [, id, tsStr] = m;
        const ts = parseInt(tsStr);
        if (!latest[id] || ts > latest[id].ts) latest[id] = { ts, file: f };
      }
    }
    // Merge — only add if not already in registry (registry takes priority)
    for (const [id, v] of Object.entries(latest)) {
      if (!registry[id]) registry[id] = `/api/media/videos/${v.file}`;
    }
  }

  // If projectId provided, build a view that prefers scoped keys over bare keys
  if (projectId) {
    const scoped: Record<string, string> = {};
    for (const [key, url] of Object.entries(registry)) {
      if (key.startsWith(`${projectId}_`)) {
        const sceneId = key.slice(projectId.length + 1);
        scoped[sceneId] = url;
      }
    }
    // For any sceneId not found in scoped entries, fall back to bare key
    for (const [key, url] of Object.entries(registry)) {
      if (!key.includes("_") || key.match(/^SC\d+$/)) {
        if (!scoped[key]) scoped[key] = url;
      }
    }
    return NextResponse.json(scoped);
  }

  return NextResponse.json(registry);
}
