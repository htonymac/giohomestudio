// Resolve a client-supplied video reference to a local file path.
// Single source of truth for the Post-Assembly editor routes (trim / add-intro /
// add-outro) — three drifted copies of this logic each missed the shape
// /api/v2v/upload actually returns ("storage/uploads/v2v/<file>", cwd-relative),
// so every editor tool 404'd with "Input file not found" (2026-07-13).
//
// Accepted shapes:
//   /api/media/<rel>          → <storageRoot>/<rel>
//   /abs/olute/path.mp4       → as-is
//   storage/uploads/v2v/x.mp4 → cwd-relative (what /api/v2v/upload returns)
//   uploads/v2v/x.mp4         → relative to the storage root
//
// Returns null when the file doesn't exist or resolves outside the app/storage
// directories (path-traversal guard).

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export function resolveVideoPath(videoUrl: string): string | null {
  const storageRoot = path.resolve(env.storagePath);
  const appRoot = path.resolve(".");
  const contained = (p: string) =>
    p.startsWith(storageRoot + path.sep) || p === storageRoot || p.startsWith(appRoot + path.sep);

  const mediaMatch = videoUrl.match(/\/api\/media\/(.+)$/);
  if (mediaMatch) {
    const p = path.resolve(storageRoot, mediaMatch[1].replace(/\//g, path.sep));
    return contained(p) && fs.existsSync(p) ? p : null;
  }
  if (path.isAbsolute(videoUrl)) {
    return fs.existsSync(videoUrl) ? videoUrl : null;
  }
  const cwdRelative = path.resolve(videoUrl);
  if (contained(cwdRelative) && fs.existsSync(cwdRelative)) return cwdRelative;
  const underStorage = path.resolve(storageRoot, videoUrl.replace(/^\//, ""));
  if (contained(underStorage) && fs.existsSync(underStorage)) return underStorage;
  return null;
}
