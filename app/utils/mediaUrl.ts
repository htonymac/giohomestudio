/**
 * Converts an asset filePath (local storage path or absolute URL) to a
 * playable /api/media/ URL. Used across all planners and editors.
 */
export function assetToMediaUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http") || filePath.startsWith("/api/")) return filePath;
  const cleaned = filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

/** Shared shape for music assets returned from /api/assets?type=music */
export interface MusicAsset {
  id: string;
  name: string;
  filePath: string;
  source?: string;
  tags?: string[];
}
