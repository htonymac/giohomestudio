// writeMedia — single helper for routing persistent media writes through the
// storage abstraction (Task #5 R2 cutover). Use this instead of fs.writeFileSync
// for GENERATED MEDIA that lives under env.storagePath (images, video, audio).
//
// Behavior:
//  - If the target path is under env.storagePath -> getStorage().put(relKey, ...).
//    With STORAGE_PROVIDER unset (local), LocalFsProvider writes the SAME absolute
//    path the old fs.writeFileSync did -> byte-identical, zero behavior change.
//    With STORAGE_PROVIDER=r2, it lands in R2 (the cutover).
//  - If the target is NOT under env.storagePath (temp dirs, /tmp, processing
//    scratch) -> plain fs write, unchanged. Temp/scratch files never belong in R2.
//
// Do NOT use this for config JSON, lockfiles, or temp scratch — only persistent media.

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { getStorage } from "./index";

/** Relative storage key for an absolute path under env.storagePath, or null if outside it. */
export function relKeyFor(absPath: string): string | null {
  const root = path.resolve(env.storagePath);
  const rel = path.relative(root, path.resolve(absPath));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
  ".json": "application/json", ".txt": "text/plain", ".srt": "text/plain", ".vtt": "text/vtt",
};

export function contentTypeForPath(p: string): string {
  return MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Write persistent media. Routes through getStorage() when the path is under
 * env.storagePath; falls back to fs for paths outside it (temp/scratch).
 * contentType defaults to detection by extension.
 */
export async function writeMedia(absPath: string, body: Buffer, contentType?: string): Promise<void> {
  const key = relKeyFor(absPath);
  if (key) {
    await getStorage().put(key, body, { contentType: contentType ?? contentTypeForPath(absPath) });
    return;
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, body);
}
