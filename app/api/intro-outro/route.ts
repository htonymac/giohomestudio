// POST /api/intro-outro — prepend intro and/or append outro to a video
// GET  /api/intro-outro — get current intro/outro settings
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);
const SETTINGS_FILE = () => path.resolve(env.storagePath, "config", "intro-outro.json");

interface IntroOutroSettings {
  introPath: string | null;    // path to intro video clip
  outroPath: string | null;    // path to outro video clip
  introEnabled: boolean;
  outroEnabled: boolean;
}

function loadSettings(): IntroOutroSettings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf-8"));
  } catch {
    return { introPath: null, outroPath: null, introEnabled: false, outroEnabled: false };
  }
}

function saveSettings(s: IntroOutroSettings) {
  const dir = path.dirname(SETTINGS_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s, null, 2));
}

export async function GET() {
  return NextResponse.json(loadSettings());
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Update settings
  if (!body.videoPath) {
    const current = loadSettings();
    const updated: IntroOutroSettings = {
      introPath: body.introPath !== undefined ? body.introPath : current.introPath,
      outroPath: body.outroPath !== undefined ? body.outroPath : current.outroPath,
      introEnabled: body.introEnabled ?? current.introEnabled,
      outroEnabled: body.outroEnabled ?? current.outroEnabled,
    };
    saveSettings(updated);
    return NextResponse.json(updated);
  }

  // Apply intro/outro to video
  const settings = loadSettings();
  if (!fs.existsSync(body.videoPath)) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const clips: string[] = [];
  const tmpDir = path.join(env.storagePath, "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  // Build concat list
  if (settings.introEnabled && settings.introPath && fs.existsSync(settings.introPath)) {
    clips.push(settings.introPath);
  }
  clips.push(body.videoPath);
  if (settings.outroEnabled && settings.outroPath && fs.existsSync(settings.outroPath)) {
    clips.push(settings.outroPath);
  }

  if (clips.length === 1) {
    return NextResponse.json({ outputPath: body.videoPath, note: "No intro/outro to add" });
  }

  // Write concat list file
  const listFile = path.join(tmpDir, `concat_${Date.now()}.txt`);
  const listContent = clips.map(c => `file '${c.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(listFile, listContent);

  const outputDir = path.join(env.storagePath, "merged");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `with_intro_outro_${Date.now()}.mp4`);

  try {
    await execFileAsync(env.ffmpegPath, [
      "-y",
      "-f", "concat", "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], { timeout: 120000 });

    // Clean up list file
    try { fs.unlinkSync(listFile); } catch { /* ok */ }

    return NextResponse.json({ outputPath });
  } catch (err) {
    try { fs.unlinkSync(listFile); } catch { /* ok */ }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Concat failed" }, { status: 500 });
  }
}
