// POST /api/video/title-card
// Generates a styled intro or outro video card using Sharp (SVG text) + FFmpeg.
// Returns: { videoUrl: "/api/media/video/title-cards/<name>.mp4" }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface TitleCardRequest {
  type: "intro" | "outro";
  studioName?: string;  // e.g. "GIO HOME AI STUDIO"
  title: string;        // story/movie title
  duration?: number;    // seconds, default 4
  // Outro-only fields:
  cast?: Array<{ characterName: string; actorName: string }>;
  director?: string;
  producer?: string;
  username?: string;
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body: TitleCardRequest = await req.json();
    const type = body.type ?? "intro";
    const studioName = (body.studioName || "GIO HOME AI STUDIO").toUpperCase();
    const title = body.title || "Untitled";
    const duration = Math.max(3, Math.min(8, body.duration ?? 4));

    const outDir = path.join(env.storagePath, "video", "title-cards");
    fs.mkdirSync(outDir, { recursive: true });
    const tempDir = path.join(env.storagePath, "video", "temp", `titlecard_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const ffmpeg = env.ffmpegPath;
    const slug = `${type}_${Date.now()}`;
    const pngPath = path.join(tempDir, `${slug}.png`);
    const mp4Path = path.join(outDir, `${slug}.mp4`);

    // ── Build SVG card with Sharp ────────────────────────────────────────────
    const W = 1920, H = 1080;
    const escape = (s: string) => s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let svg: string;

    if (type === "intro") {
      svg = buildIntroSvg(W, H, studioName, title, escape);
    } else {
      svg = buildOutroSvg(W, H, studioName, title, body.cast ?? [], body.director, body.producer, body.username, escape);
    }

    const sharp = (await import("sharp")).default;
    await sharp(Buffer.from(svg)).png().toFile(pngPath);

    // ── Convert PNG to video with fade-in and subtle zoom ───────────────────
    const fps = 25;
    const totalFrames = Math.round(duration * fps);
    const fadeDur = Math.min(0.8, duration * 0.2);

    await execFileAsync(ffmpeg, [
      "-loop", "1", "-i", pngPath,
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-vf", [
        `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black`,
        `zoompan=z='min(zoom+0.0008,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`,
        `fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${Math.max(duration - fadeDur, duration - 0.8)}:d=${fadeDur}`,
      ].join(","),
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
      "-c:a", "aac", "-b:a", "128k",
      "-pix_fmt", "yuv420p",
      "-t", String(duration),
      "-movflags", "+faststart", "-shortest", "-y", mp4Path,
    ], { timeout: 60000 });

    // Clean temp PNG
    try { fs.unlinkSync(pngPath); } catch { /* ok */ }
    try { fs.rmdirSync(tempDir); } catch { /* ok */ }

    const videoUrl = `/api/media/video/title-cards/${slug}.mp4`;
    return NextResponse.json({ videoUrl, duration });
  } catch (err) {
    console.error("[title-card] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── SVG builders ────────────────────────────────────────────────────────────

function buildIntroSvg(W: number, H: number, studioName: string, title: string, escape: (s: string) => string): string {
  const titleWords = title.split(/\s+/);
  const titleLines: string[] = [];
  let cur = "";
  for (const w of titleWords) {
    if ((cur + " " + w).trim().length > 22 && cur) { titleLines.push(cur.trim()); cur = w; }
    else { cur = cur ? cur + " " + w : w; }
  }
  if (cur.trim()) titleLines.push(cur.trim());
  const titleY = H / 2 + 20;
  const titleTspans = titleLines.map((l, i) =>
    `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 90}">${escape(l)}</tspan>`
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#05050f"/>
        <stop offset="50%" stop-color="#0a0520"/>
        <stop offset="100%" stop-color="#03080a"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="titleglow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${W}" height="${H}" fill="url(#bg)"/>

    <!-- Decorative horizontal lines -->
    <line x1="160" y1="${H / 2 - 110}" x2="${W - 160}" y2="${H / 2 - 110}"
      stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <line x1="160" y1="${H / 2 + titleLines.length * 90 + 40}" x2="${W - 160}" y2="${H / 2 + titleLines.length * 90 + 40}"
      stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

    <!-- Accent corner marks -->
    <rect x="140" y="${H / 2 - 120}" width="20" height="2" fill="rgba(160,100,220,0.8)"/>
    <rect x="140" y="${H / 2 - 120}" width="2" height="20" fill="rgba(160,100,220,0.8)"/>
    <rect x="${W - 160}" y="${H / 2 - 120}" width="20" height="2" fill="rgba(160,100,220,0.8)"/>
    <rect x="${W - 162}" y="${H / 2 - 120}" width="2" height="20" fill="rgba(160,100,220,0.8)"/>

    <!-- Studio name -->
    <text x="${W / 2}" y="${H / 2 - 130}"
      text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif"
      font-size="22"
      font-weight="700"
      fill="rgba(160,100,220,0.9)"
      letter-spacing="12">${escape(studioName)}</text>

    <!-- "presents" -->
    <text x="${W / 2}" y="${H / 2 - 60}"
      text-anchor="middle"
      font-family="Georgia,'Times New Roman',serif"
      font-size="28"
      font-weight="400"
      fill="rgba(255,255,255,0.55)"
      letter-spacing="8"
      font-style="italic">presents</text>

    <!-- Title (large, white) -->
    <text x="${W / 2}" y="${titleY}"
      text-anchor="middle"
      font-family="'Arial Black',Impact,sans-serif"
      font-size="82"
      font-weight="900"
      fill="white"
      filter="url(#titleglow)"
      letter-spacing="2">${titleTspans}</text>
  </svg>`;
}

function buildOutroSvg(
  W: number, H: number, studioName: string, title: string,
  cast: Array<{ characterName: string; actorName: string }>,
  director: string | undefined,
  producer: string | undefined,
  username: string | undefined,
  escape: (s: string) => string,
): string {
  const credits: Array<{ role: string; name: string }> = [];
  cast.slice(0, 6).forEach(c => credits.push({ role: escape(c.characterName), name: escape(c.actorName) }));
  if (director) credits.push({ role: "Director", name: escape(director) });
  if (producer) credits.push({ role: "Producer", name: escape(producer) });
  if (username) credits.push({ role: "Created by", name: escape(username) });

  const creditRowH = 50;
  const startY = Math.max(140, H / 2 - (credits.length * creditRowH) / 2);
  const creditRows = credits.map((c, i) => {
    const y = startY + i * creditRowH;
    return `
    <text x="${W / 2 - 180}" y="${y}"
      text-anchor="end"
      font-family="Georgia,serif"
      font-size="20"
      fill="rgba(255,255,255,0.45)"
      letter-spacing="3">${c.role.toUpperCase()}</text>
    <text x="${W / 2 + 180}" y="${y}"
      text-anchor="start"
      font-family="Arial,Helvetica,sans-serif"
      font-size="22"
      font-weight="700"
      fill="white">${c.name}</text>
    <line x1="${W / 2 - 140}" y1="${y - 4}" x2="${W / 2 + 140}" y2="${y - 4}"
      stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#030312"/>
        <stop offset="100%" stop-color="#07040f"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>

    <!-- Title at top -->
    <text x="${W / 2}" y="80"
      text-anchor="middle"
      font-family="'Arial Black',Impact,sans-serif"
      font-size="42"
      font-weight="900"
      fill="rgba(255,255,255,0.9)"
      letter-spacing="3">${escape(title.toUpperCase())}</text>
    <line x1="280" y1="102" x2="${W - 280}" y2="102"
      stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

    <!-- Cast & crew credits -->
    ${creditRows}

    <!-- Studio footer -->
    <text x="${W / 2}" y="${H - 54}"
      text-anchor="middle"
      font-family="Arial,Helvetica,sans-serif"
      font-size="16"
      fill="rgba(160,100,220,0.7)"
      letter-spacing="8">${escape(studioName)}</text>
    <line x1="280" y1="${H - 72}" x2="${W - 280}" y2="${H - 72}"
      stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  </svg>`;
}
