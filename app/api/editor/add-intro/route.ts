// POST /api/editor/add-intro
// Prepends an intro to a video using FFmpeg. Three modes:
//   - useFirstFrame → freeze the video's FIRST frame (scaled/padded to the video) as
//     an N-second intro background, with branded headline/subline text on top —
//     a commercial "cold open" card. Mirrors add-outro's freeze-last-frame branch,
//     but grabs frame 0 and PREPENDS the segment instead of appending it.
//   - imageUrl present → use that image (e.g. a logo/product shot) as the intro
//     background instead of a video frame.
//   - text only → append a text-on-black card (legacy behaviour, unchanged).
// Robust for ANY imported clip: normalises res/fps/sar and handles videos with OR
// without an audio track (Henry 2026-07-23: intro card to match the outro card).
// Body: { videoUrl, imageUrl?, useFirstFrame?, headline?, subline?, text?, duration?, style? }
// Returns: { ok, outputUrl }

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { resolveVideoPath } from "@/lib/resolve-video-path";
import { resolveFontFile } from "@/modules/ffmpeg/utils";

// The intro pulls its font + colours from the saved Brand Kit so cold-open cards
// match the rest of the brand. Falls back to sensible defaults if none saved.
function readBrandKit(): { fontFamily: string; headlineColor: string; bodyColor: string; bgColor: string; bgOpacity: number } {
  const def = { fontFamily: "Poppins", headlineColor: "#FFFFFF", bodyColor: "#F5D06B", bgColor: "#000000", bgOpacity: 0.4 };
  try {
    const raw = fs.readFileSync(path.join(env.storagePath, "config", "brand-kit.json"), "utf8");
    const k = JSON.parse(raw) as Partial<typeof def>;
    return {
      fontFamily: k.fontFamily || def.fontFamily,
      headlineColor: k.headlineColor || def.headlineColor,
      bodyColor: k.bodyColor || def.bodyColor,
      bgColor: k.bgColor || def.bgColor,
      bgOpacity: Number.isFinite(k.bgOpacity) ? Math.max(0, Math.min(1, k.bgOpacity as number)) : def.bgOpacity,
    };
  } catch {
    return def;
  }
}

const hexToFF = (h: string) => `0x${h.replace("#", "")}`;

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, imageUrl, useFirstFrame, text, headline, subline, duration = 3, style } = await req.json() as {
      videoUrl?: string;
      imageUrl?: string;
      useFirstFrame?: boolean;  // freeze the video's first frame as the intro background
      text?: string;            // legacy text-on-black card
      headline?: string;        // big line drawn on an image/freeze intro
      subline?: string;         // smaller line under the headline
      duration?: number;
      // Per-intro text decoration (overrides the Brand Kit defaults when set).
      style?: {
        fontFamily?: string;      // "Poppins" | "Montserrat" | "Bebas Neue" | "Anton" | classic
        headlineColor?: string;   // hex
        sublineColor?: string;    // hex
        scale?: number;           // multiplier on the default text size (0.6–1.8)
      };
    };

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
    }
    if (!imageUrl && !useFirstFrame && !text?.trim()) {
      return NextResponse.json({ error: "Provide imageUrl, useFirstFrame, or text" }, { status: 400 });
    }

    const inputPath = resolveVideoPath(videoUrl);
    if (!inputPath || !fs.existsSync(inputPath)) {
      return NextResponse.json({ error: `Input file not found: ${videoUrl}` }, { status: 404 });
    }

    const { width, height } = await probeVideoSize(inputPath);
    const w = width || 1920;
    const h = height || 1080;
    const dur = Math.min(15, Math.max(1, Number(duration) || 3));

    const outDir = path.resolve(env.storagePath, "video");
    fs.mkdirSync(outDir, { recursive: true });
    const outName = `intro_${Date.now()}.mp4`;
    const outPath = path.join(outDir, outName);

    // ── Image / freeze-first-frame intro (with optional branded text) ──
    //    Single-pass concat FILTER (re-encode) so it works on any imported codec.
    //    The intro segment goes FIRST, the main video SECOND.
    if (imageUrl || useFirstFrame) {
      let bgPath: string;
      let cleanupBg: string | null = null;
      if (useFirstFrame) {
        // Grab the opening frame of the video and freeze it as the background.
        bgPath = path.join(outDir, `firstframe_${Date.now()}.png`);
        await runFFmpeg(["-ss", "0", "-i", inputPath, "-frames:v", "1", "-y", bgPath]);
        if (!fs.existsSync(bgPath)) {
          return NextResponse.json({ error: "Could not read the video's first frame" }, { status: 500 });
        }
        cleanupBg = bgPath;
      } else {
        const imgPath = resolveVideoPath(imageUrl!);
        if (!imgPath || !fs.existsSync(imgPath)) {
          return NextResponse.json({ error: `Intro image not found: ${imageUrl}` }, { status: 404 });
        }
        bgPath = imgPath;
      }

      const hasAudio = await probeHasAudio(inputPath);
      const brand = readBrandKit();
      // Per-intro overrides win over the Brand Kit defaults.
      const fontFamily = style?.fontFamily?.trim() || brand.fontFamily;
      const headlineColor = style?.headlineColor?.trim() || brand.headlineColor;
      const sublineColor = style?.sublineColor?.trim() || brand.bodyColor;
      const scale = Math.min(1.8, Math.max(0.6, Number(style?.scale) || 1));
      const font = resolveFontFile({ fontFamily, bold: true }) || pickFontFile();

      // Branded text drawn on the intro frame. WRAPS to multiple lines on a dark
      // scrim for readability, matching the outro's freeze-frame text treatment.
      const textFilters: string[] = [];
      const hasText = !!(headline?.trim() || subline?.trim());
      if (hasText) {
        textFilters.push(`drawbox=x=0:y=0:w=iw:h=ih:color=${hexToFF(brand.bgColor)}@${brand.bgOpacity}:t=fill`);
        const hlSize = Math.round(w * 0.072 * scale);
        const slSize = Math.round(w * 0.046 * scale);
        const hlLines = headline?.trim() ? wrapText(headline, w, hlSize) : [];
        const slLines = subline?.trim() ? wrapText(subline, w, slSize) : [];
        const hlH = Math.round(hlSize * 1.25);
        const slH = Math.round(slSize * 1.3);
        const gap = slLines.length && hlLines.length ? Math.round(hlSize * 0.5) : 0;
        const totalH = hlLines.length * hlH + gap + slLines.length * slH;
        const top = `(h-${totalH})/2`;
        let off = 0;
        for (const line of hlLines) { textFilters.push(drawText(line, hlSize, hexToFF(headlineColor), `${top}+${off}`, font)); off += hlH; }
        off += gap;
        for (const line of slLines) { textFilters.push(drawText(line, slSize, hexToFF(sublineColor), `${top}+${off}`, font)); off += slH; }
      }
      const tail = textFilters.length ? `,${textFilters.join(",")}` : "";
      const normV = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;

      const args: string[] = [
        "-i", inputPath,
        "-loop", "1", "-t", String(dur), "-i", bgPath,
      ];
      let filter: string;
      if (hasAudio) {
        args.push("-f", "lavfi", "-t", String(dur), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
        // [v1] = intro segment (silent), [v0]+[a0] = main video with its real audio.
        // Intro plays FIRST in the concat, main video SECOND.
        filter =
          `[0:v]${normV}[v0];[1:v]${normV}${tail}[v1];` +
          `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];` +
          `[v1][2:a][v0][a0]concat=n=2:v=1:a=1[outv][outa]`;
        args.push("-filter_complex", filter, "-map", "[outv]", "-map", "[outa]",
          "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "-y", outPath);
      } else {
        filter = `[0:v]${normV}[v0];[1:v]${normV}${tail}[v1];[v1][v0]concat=n=2:v=1:a=0[outv]`;
        args.push("-filter_complex", filter, "-map", "[outv]",
          "-c:v", "libx264", "-movflags", "+faststart", "-y", outPath);
      }
      try {
        await runFFmpeg(args);
      } finally {
        if (cleanupBg) { try { fs.unlinkSync(cleanupBg); } catch { /* temp */ } }
      }
      return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
    }

    // ── Legacy text-on-black card ──
    const introPath = path.join(outDir, `intro_card_${Date.now()}.mp4`);
    const listPath = path.join(outDir, `concat_intro_${Date.now()}.txt`);
    const clean = (text ?? "").replace(/['"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    const fontsize = Math.max(28, Math.round(w * 0.06));
    const maxChars = Math.max(8, Math.floor((w * 0.86) / (fontsize * 0.6)));
    const words = clean.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const wd of words) {
      const cand = cur ? `${cur} ${wd}` : wd;
      if (cand.length > maxChars && cur) { lines.push(cur); cur = wd; } else cur = cand;
    }
    if (cur) lines.push(cur);
    const drawTextValue = lines.join("\\n"); // literal \n → drawtext line break
    await runFFmpeg([
      "-f", "lavfi",
      "-i", `color=c=black:s=${w}x${h}:d=${dur}:r=24`,
      "-vf", `drawtext=text='${drawTextValue}':fontcolor=white:fontsize=${fontsize}:line_spacing=12:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-an",
      "-y", introPath,
    ]);
    fs.writeFileSync(listPath, `file '${introPath.replace(/\\/g, "/")}'\nfile '${inputPath.replace(/\\/g, "/")}'\n`);
    await runFFmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-y", outPath]);
    try { fs.unlinkSync(introPath); fs.unlinkSync(listPath); } catch { /* ignore */ }

    return NextResponse.json({ ok: true, outputUrl: `/api/media/video/${outName}` });
  } catch (err) {
    console.error("[editor/add-intro]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Pick a bold, MODERN font for the intro card (Montserrat/Poppins bundled in the
// repo → the social-media look), falling back to system fonts. null → drawtext default.
function pickFontFile(): string | null {
  const bundled = path.resolve("assets", "fonts");
  const candidates = [
    path.join(bundled, "Montserrat-Bold.ttf"),
    path.join(bundled, "Poppins-Bold.ttf"),
    path.join(bundled, "Anton-Regular.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
  ];
  for (const f of candidates) { try { if (fs.existsSync(f)) return f; } catch { /* skip */ } }
  return null;
}

// Break text to fit the width (honours explicit newlines first) → multiple lines.
function wrapText(text: string, w: number, fontsize: number): string[] {
  const maxChars = Math.max(6, Math.floor((w * 0.88) / (fontsize * 0.5)));
  const out: string[] = [];
  for (const seg of text.split(/\r?\n/)) {
    const words = seg.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let cur = "";
    for (const word of words) {
      const cand = cur ? `${cur} ${word}` : word;
      if (cand.length > maxChars && cur) { out.push(cur); cur = word; } else cur = cand;
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [text.trim()];
}

function escapeDT(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "’").replace(/[\r\n]+/g, " ").slice(0, 120);
}

function drawText(text: string, fontsize: number, color: string, yExpr: string, font: string | null): string {
  const parts = [
    `text='${escapeDT(text)}'`,
    `fontsize=${fontsize}`,
    `fontcolor=${color}`,
    `x=(w-text_w)/2`,
    `y=${yExpr}`,
    `borderw=${Math.max(2, Math.round(fontsize * 0.06))}:bordercolor=black@0.85`,
    `shadowx=2:shadowy=2:shadowcolor=black@0.6`,
  ];
  if (font) parts.unshift(`fontfile=${font.replace(/\\/g, "/").replace(/:/g, "\\:")}`);
  return `drawtext=${parts.join(":")}`;
}

async function probeVideoSize(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", filePath]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const parts = out.trim().split(",");
      resolve({ width: parseInt(parts[0]) || 0, height: parseInt(parts[1]) || 0 });
    });
    proc.on("error", () => resolve({ width: 0, height: 0 }));
  });
}

async function probeHasAudio(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "csv=p=0", filePath]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => resolve(out.trim().length > 0));
    proc.on("error", () => resolve(false));
  });
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  });
}
