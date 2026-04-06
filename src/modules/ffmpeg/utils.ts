import * as path from "path";
import * as fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

// ── Mobile-safe H.264 export settings ────────────────────────────────────────
//
// Every video exported by GioHomeStudio must pass through these encode flags so
// it plays on Android, iPhone, Telegram mobile, and mobile browsers.
//
// Root cause of phone-incompatibility:
//   When transparent PNG captions (RGBA) are overlaid via FFmpeg's `overlay` filter
//   with format=auto, FFmpeg selects yuvj444p as the intermediate pixel format.
//   libx264 then encodes this as H.264 "High 4:4:4 Predictive" (Hi444PP) profile —
//   which mobile hardware decoders do NOT support. Result: black screen / cannot play.
//
// Fix: always force `-pix_fmt yuv420p` on the encoder. This overrides whatever
//   pixel format the filter graph produces and guarantees a mobile-compatible stream.
//   Combined with `-profile:v high -level 4.1` this is universally supported.
export const MOBILE_H264_OPTS = [
  "-pix_fmt yuv420p",
  "-profile:v high",
  "-level 4.1",
  "-color_range tv",
  "-colorspace bt709",
  "-color_primaries bt709",
  "-color_trc bt709",
] as const;

export const MOBILE_AUDIO_OPTS = [
  "-c:a aac",
  "-b:a 128k",
  "-ar 48000",
] as const;

// ── Mobile compatibility validator ────────────────────────────────────────────

export interface MobileCompatReport {
  ok: boolean;
  issues: string[];
  vcodec?: string;
  pix_fmt?: string;
  profile?: string;
  acodec?: string;
  width?: number;
  height?: number;
  duration?: number;
}

/**
 * Runs ffprobe on a finished video file and checks it meets the mobile-safe
 * H.264/AAC/yuv420p standard required for Android, iPhone, and Telegram mobile.
 * Returns { ok: true } when all checks pass; { ok: false, issues: [...] } otherwise.
 */
export async function validateMobileCompatible(filePath: string): Promise<MobileCompatReport> {
  const issues: string[] = [];
  let parsed: Record<string, unknown> = {};

  try {
    const { stdout } = await execFileAsync(env.ffprobePath, [
      "-v", "error",
      "-show_streams", "-show_format",
      "-print_format", "json",
      filePath,
    ]);
    parsed = JSON.parse(stdout) as Record<string, unknown>;
  } catch (err) {
    return { ok: false, issues: [`ffprobe failed: ${err}`] };
  }

  const streams = (parsed.streams as Record<string, unknown>[]) ?? [];
  const video   = streams.find(s => s.codec_type === "video");
  const audio   = streams.find(s => s.codec_type === "audio");
  const fmt     = parsed.format as Record<string, unknown> | undefined;

  const vcodec  = video?.codec_name as string | undefined;
  const pix_fmt = video?.pix_fmt    as string | undefined;
  const profile = video?.profile    as string | undefined;
  const width   = video?.width      as number | undefined;
  const height  = video?.height     as number | undefined;
  const acodec  = audio?.codec_name as string | undefined;
  const duration = parseFloat((fmt?.duration as string | undefined) ?? "0");

  if (vcodec !== "h264")                          issues.push(`vcodec=${vcodec} (need h264)`);
  if (pix_fmt && pix_fmt !== "yuv420p")           issues.push(`pix_fmt=${pix_fmt} (need yuv420p)`);
  if (profile && profile.includes("4:4:4"))       issues.push(`profile=${profile} (mobile unsupported — need High or Main)`);
  if (width  && width  % 2 !== 0)                 issues.push(`width=${width} is odd (must be even)`);
  if (height && height % 2 !== 0)                 issues.push(`height=${height} is odd (must be even)`);
  if (acodec && acodec !== "aac")                 issues.push(`acodec=${acodec} (need aac)`);
  if (!duration || duration < 0.5)               issues.push(`duration=${duration}s (video too short or invalid)`);

  return {
    ok: issues.length === 0,
    issues,
    vcodec, pix_fmt, profile, acodec, width, height, duration,
  };
}

// FFmpeg requires forward slashes even on Windows
export function toFFmpegPath(p: string): string {
  return p.replace(/\\/g, "/");
}

// Escape text for FFmpeg drawtext filter — used by overlay.ts and index.ts
// \n chars are converted to FFmpeg's literal \n escape so multi-line text renders correctly.
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:");
}

// Wrap text at word boundaries so captions don't overflow the video frame.
// Pre-existing \n characters are preserved — each segment is wrapped independently.
export function wrapCaptionText(text: string, maxChars = 32): string {
  return text.split("\n").map(segment => {
    const words = segment.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.join("\n");
  }).join("\n");
}

// Escape a file system path for use inside a drawtext fontfile= value.
// When the path is relative (no drive letter), no colon escaping is needed.
// Still applied defensively in case an absolute path slips through.
export function escapeFontPath(p: string): string {
  return toFFmpegPath(p).replace(/:/g, "\\:");
}

// Silently delete a file — used for temp file cleanup after FFmpeg operations.
export function cleanupTempFile(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

// Returns true only when path is a regular file (not a directory, device, symlink-to-dir, etc.).
// fs.existsSync("") → false on Node/Windows, BUT fs.existsSync(".") → true (CWD is a directory).
// Using statSync prevents directories from being passed to FFmpeg as inputs, which would cause
// exit code -13 (EACCES) because FFmpeg tries to open the directory as a media container.
export function isActualFile(p: string): boolean {
  if (!p?.trim()) return false;
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Font variants: Windows filename for each family + weight/style combination.
// Key = lowercase family name, value = { normal, bold, italic, boldItalic } filenames.
const FONT_VARIANTS: Record<string, { normal: string; bold: string; italic: string; boldItalic: string }> = {
  "arial":           { normal: "arial.ttf",    bold: "arialbd.ttf",  italic: "ariali.ttf",   boldItalic: "arialbi.ttf" },
  "sans":            { normal: "arial.ttf",    bold: "arialbd.ttf",  italic: "ariali.ttf",   boldItalic: "arialbi.ttf" },
  "georgia":         { normal: "georgia.ttf",  bold: "georgiab.ttf", italic: "georgiai.ttf", boldItalic: "georgiaz.ttf" },
  "verdana":         { normal: "verdana.ttf",  bold: "verdanab.ttf", italic: "verdanai.ttf", boldItalic: "verdanaz.ttf" },
  "times new roman": { normal: "times.ttf",    bold: "timesbd.ttf",  italic: "timesi.ttf",   boldItalic: "timesbi.ttf" },
  "trebuchet ms":    { normal: "trebuc.ttf",   bold: "trebucbd.ttf", italic: "trebucit.ttf", boldItalic: "trebucbi.ttf" },
  "impact":          { normal: "impact.ttf",   bold: "impact.ttf",   italic: "impact.ttf",   boldItalic: "impact.ttf" },
  "courier new":     { normal: "cour.ttf",     bold: "courbd.ttf",   italic: "couri.ttf",    boldItalic: "courbi.ttf" },
};

// Collect all unique Windows filenames so we know what to try copying.
const ALL_FONT_FILES = new Set(
  Object.values(FONT_VARIANTS).flatMap(v => Object.values(v))
);

let _fontsReady = false;

// Copy all known font variants from the system font dir into storage/fonts/ on first call.
// Relative paths in storage/fonts/ have no Windows drive-letter colon, avoiding the
// "No option name near '/Windows/Fonts/arial.ttf'" FFmpeg drawtext parsing error.
function ensureFontsAvailable(): string {
  const destDir = path.resolve(env.storagePath, "fonts");
  if (!_fontsReady) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const file of ALL_FONT_FILES) {
      const dest = path.join(destDir, file);
      if (!fs.existsSync(dest)) {
        const src = path.join(env.fontDir, file);
        try { fs.copyFileSync(src, dest); } catch { /* font not installed — skip */ }
      }
    }
    _fontsReady = true;
  }
  return destDir;
}

// Pick the correct font file for the requested family/style.
// Returns a path relative to the project root so FFmpeg receives no drive-letter colon.
// Falls back to bold/regular Arial if the requested font is not installed on this machine.
export function resolveFontFile(opts: {
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
}): string {
  const destDir = ensureFontsAvailable();
  const { bold, italic } = opts;
  const familyKey = (opts.fontFamily ?? "arial").toLowerCase().trim();
  const styleKey  = bold && italic ? "boldItalic" : bold ? "bold" : italic ? "italic" : "normal";

  // Look up the Windows filename for this family; fall back to Arial.
  const variants = FONT_VARIANTS[familyKey] ?? FONT_VARIANTS["arial"];
  let fileName = variants[styleKey];

  // If the chosen file doesn't exist in storage/fonts/, fall back through the style
  // hierarchy until we reach plain Arial — which is always present on Windows.
  const fallback = [fileName, variants.normal, FONT_VARIANTS["arial"][styleKey], "arial.ttf"];
  fileName = fallback.find(f => fs.existsSync(path.join(destDir, f))) ?? "arial.ttf";

  const absPath = path.join(destDir, fileName);
  // Relative path strips the drive letter — safe for FFmpeg drawtext on Windows.
  return toFFmpegPath(path.relative(process.cwd(), absPath));
}
