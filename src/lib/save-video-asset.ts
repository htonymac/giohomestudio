// Shared utility: save any final video output to the asset library JSON
// so it always appears in /dashboard/assets (the user's video history).

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const ASSETS_FILE = () => path.resolve(env.storagePath, "config", "asset-library.json");

function loadAssets(): unknown[] {
  try { return JSON.parse(fs.readFileSync(ASSETS_FILE(), "utf-8")); } catch { return []; }
}

export function saveVideoAsset(opts: {
  filePath: string;          // absolute filesystem path to the MP4
  title: string;             // human-readable name
  source: string;            // "scene_forge" | "children_planner" | "movie_planner" | "hybrid_planner" | "video_assembler"
  thumbnailPath?: string;
  durationSeconds?: number;
  tags?: string[];
}) {
  try {
    const dir = path.dirname(ASSETS_FILE());
    fs.mkdirSync(dir, { recursive: true });

    const assets = loadAssets() as Array<{ filePath?: string }>;

    // Skip duplicate (same file already saved)
    if (assets.some(a => a.filePath === opts.filePath)) return;

    const entry = {
      id: `vid_${Date.now()}`,
      type: "video",
      name: opts.title,
      description: opts.durationSeconds ? `${Math.round(opts.durationSeconds)}s video` : "Video",
      filePath: opts.filePath,
      thumbnailPath: opts.thumbnailPath,
      tags: opts.tags ?? [opts.source, "video"],
      source: opts.source,
      safeForAutoMode: false,
      createdAt: new Date().toISOString(),
    };

    assets.unshift(entry);
    fs.writeFileSync(ASSETS_FILE(), JSON.stringify(assets, null, 2));
  } catch { /* best-effort — never block video delivery */ }
}
