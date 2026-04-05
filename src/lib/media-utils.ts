// Shared MIME type sets and filename sanitizer for upload routes.

export const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
]);

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Strip characters unsafe for filenames, truncate to maxLen. */
export function sanitizeFilename(name: string, maxLen = 60): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, maxLen);
}

/** Extract a JSON object/array from LLM output that may include markdown fences. */
export function extractJSONFromLLM(text: string): string {
  // First strip markdown fences
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  // Then grab the first {...} or [...] block in case of surrounding prose
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : stripped;
}
