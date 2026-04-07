// POST /api/watermark — apply brand logo watermark to a video
// GET  /api/watermark — get current watermark settings
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

const SETTINGS_FILE = () => path.resolve(env.storagePath, "config", "watermark.json");

interface WatermarkSettings {
  logoPath: string | null;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  opacity: number;     // 0-1
  scale: number;       // 0.05-0.5 (fraction of video width)
  margin: number;      // pixels from edge
}

function loadSettings(): WatermarkSettings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf-8"));
  } catch {
    return { logoPath: null, position: "bottom-right", opacity: 0.7, scale: 0.15, margin: 20 };
  }
}

function saveSettings(s: WatermarkSettings) {
  const dir = path.dirname(SETTINGS_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s, null, 2));
}

export async function GET() {
  return NextResponse.json(loadSettings());
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // If updating settings (no videoPath)
  if (!body.videoPath) {
    const current = loadSettings();
    const updated: WatermarkSettings = {
      logoPath: body.logoPath ?? current.logoPath,
      position: body.position ?? current.position,
      opacity: body.opacity ?? current.opacity,
      scale: body.scale ?? current.scale,
      margin: body.margin ?? current.margin,
    };
    saveSettings(updated);
    return NextResponse.json(updated);
  }

  // Apply watermark to video
  const settings = loadSettings();
  if (!settings.logoPath || !fs.existsSync(settings.logoPath)) {
    return NextResponse.json({ error: "No watermark logo configured" }, { status: 400 });
  }
  if (!fs.existsSync(body.videoPath)) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const outputDir = path.join(env.storagePath, "merged");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `watermarked_${Date.now()}.mp4`);

  // Position expressions
  const posMap: Record<string, string> = {
    "top-left":     `${settings.margin}:${settings.margin}`,
    "top-right":    `W-w-${settings.margin}:${settings.margin}`,
    "bottom-left":  `${settings.margin}:H-h-${settings.margin}`,
    "bottom-right": `W-w-${settings.margin}:H-h-${settings.margin}`,
    "center":       `(W-w)/2:(H-h)/2`,
  };
  const pos = posMap[settings.position] ?? posMap["bottom-right"];

  try {
    await execFileAsync(env.ffmpegPath, [
      "-y",
      "-i", body.videoPath,
      "-i", settings.logoPath,
      "-filter_complex",
      `[1:v]format=rgba,colorchannelmixer=aa=${settings.opacity},scale=iw*${settings.scale}:-1[wm];[0:v][wm]overlay=${pos}[out]`,
      "-map", "[out]",
      "-map", "0:a?",
      "-c:v", "libx264", "-crf", "20", "-preset", "medium",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], { timeout: 120000 });

    return NextResponse.json({ outputPath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Watermark failed" }, { status: 500 });
  }
}
