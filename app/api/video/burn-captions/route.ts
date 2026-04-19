// POST /api/video/burn-captions
// Burns CapCut-style animated word-by-word captions onto a video using FFmpeg ASS subtitles.
// Flow:
//   1. If transcribe=true: calls OpenAI Whisper with word-level timestamps to get captions automatically
//   2. Generates ASS subtitle file with per-word timing and styled appearance
//   3. FFmpeg burns the ASS file into the video
// Returns: { ok: true, outputUrl } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 300; // 5 minutes

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface BurnRequest {
  videoUrl: string;
  transcribe?: boolean;          // auto-transcribe the audio using Whisper
  captions?: CaptionWord[];      // manual captions (if transcribe=false)
  style?: "tiktok" | "youtube" | "minimal" | "bold_white" | "neon";
  position?: "bottom" | "center" | "top";
  wordsPerGroup?: number;        // words to show at once (default 3 for TikTok style)
}

// Resolve an API URL or media path to an absolute filesystem path
function resolveToFsPath(url: string): string {
  if (url.startsWith("/api/media/")) {
    return path.join(env.storagePath, url.replace("/api/media/", ""));
  }
  if (path.isAbsolute(url)) return url;
  return url;
}

// Download a URL to a temp file, return the temp path
async function downloadToTemp(url: string, ext: string, tempDir: string): Promise<string> {
  const dest = path.join(tempDir, `dl_${uuidv4()}${ext}`);
  if (url.startsWith("/api/media/") || url.startsWith("/")) {
    // Local path — copy
    const localPath = resolveToFsPath(url);
    fs.copyFileSync(localPath, dest);
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  return dest;
}

// Transcribe audio from a video file using OpenAI Whisper with word timestamps
async function transcribeWithWhisper(videoPath: string, tempDir: string): Promise<CaptionWord[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured — cannot auto-transcribe");

  // Extract audio from video for faster transcription
  const audioPath = path.join(tempDir, `audio_${uuidv4()}.mp3`);
  await execFileAsync(env.ffmpegPath, [
    "-i", videoPath, "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k", "-y", audioPath,
  ], { timeout: 60000 });

  // Send to Whisper with word-level timestamps
  const formData = new FormData();
  formData.append("file", new Blob([fs.readFileSync(audioPath)], { type: "audio/mp3" }), "audio.mp3");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const words: CaptionWord[] = (data.words ?? []).map((w: { word: string; start: number; end: number }) => ({
    word: w.word.trim(),
    start: w.start,
    end: w.end,
  }));

  // Clean up temp audio
  try { fs.unlinkSync(audioPath); } catch { /* ignore */ }

  return words;
}

// Group words into display chunks (wordsPerGroup at a time)
function groupWords(words: CaptionWord[], perGroup: number): Array<{ text: string; start: number; end: number }> {
  const groups: Array<{ text: string; start: number; end: number }> = [];
  for (let i = 0; i < words.length; i += perGroup) {
    const chunk = words.slice(i, i + perGroup);
    if (chunk.length === 0) continue;
    groups.push({
      text: chunk.map(w => w.word).join(" ").trim(),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
    });
  }
  return groups;
}

// Format seconds to ASS time: H:MM:SS.cc
function toASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// Build ASS subtitle file content
function buildASS(
  groups: Array<{ text: string; start: number; end: number }>,
  style: string,
  position: string,
): string {
  // ASS style definitions per visual preset
  const styles: Record<string, { fontName: string; fontSize: number; primaryColor: string; outlineColor: string; backColor: string; bold: boolean; outline: number; shadow: number; alignment: number; marginV: number }> = {
    tiktok: { fontName: "Arial Black", fontSize: 52, primaryColor: "&H00FFFFFF", outlineColor: "&H00000000", backColor: "&H80000000", bold: true, outline: 3, shadow: 2, alignment: 2, marginV: 80 },
    youtube: { fontName: "Arial", fontSize: 44, primaryColor: "&H00FFFFFF", outlineColor: "&H00000000", backColor: "&HA0000000", bold: false, outline: 2, shadow: 1, alignment: 2, marginV: 60 },
    minimal: { fontName: "Helvetica", fontSize: 36, primaryColor: "&H00FFFFFF", outlineColor: "&H80000000", backColor: "&H00000000", bold: false, outline: 1, shadow: 0, alignment: 2, marginV: 50 },
    bold_white: { fontName: "Impact", fontSize: 58, primaryColor: "&H00FFFFFF", outlineColor: "&H00000000", backColor: "&H00000000", bold: true, outline: 4, shadow: 3, alignment: 2, marginV: 70 },
    neon: { fontName: "Arial Black", fontSize: 48, primaryColor: "&H0000FFFF", outlineColor: "&H00FF00FF", backColor: "&H00000000", bold: true, outline: 3, shadow: 1, alignment: 2, marginV: 70 },
  };

  const s = styles[style] ?? styles.tiktok;

  // Alignment: 2=bottom-center, 5=middle-center, 8=top-center
  const alignmentMap: Record<string, number> = { bottom: 2, center: 5, top: 8 };
  const align = alignmentMap[position] ?? 2;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${s.fontName},${s.fontSize},${s.primaryColor},&H000000FF,${s.outlineColor},${s.backColor},${s.bold ? -1 : 0},0,0,0,100,100,0,0,1,${s.outline},${s.shadow},${align},40,40,${s.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = groups.map(g => {
    // Escape curly braces in text
    const text = g.text.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
    // Add fade-in animation (\\fad(fadein_ms, fadeout_ms))
    return `Dialogue: 0,${toASSTime(g.start)},${toASSTime(g.end)},Default,,0,0,0,,{\\fad(80,80)}${text}`;
  });

  return header + events.join("\n") + "\n";
}

export async function POST(req: NextRequest) {
  let body: BurnRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { videoUrl, transcribe = true, captions, style = "tiktok", position = "bottom", wordsPerGroup = 3 } = body;

  if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });

  const tempDir = path.join(env.storagePath, "video", "temp", `captions_${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 1. Get video as local file
    const videoPath = await downloadToTemp(videoUrl, ".mp4", tempDir);

    // 2. Get captions (transcribe or use provided)
    let words: CaptionWord[] = captions ?? [];
    if (transcribe && words.length === 0) {
      words = await transcribeWithWhisper(videoPath, tempDir);
    }

    if (words.length === 0) {
      return NextResponse.json({ error: "No captions provided and transcription returned no words" }, { status: 400 });
    }

    // 3. Group into display chunks
    const groups = groupWords(words, wordsPerGroup);

    // 4. Build ASS file
    const assContent = buildASS(groups, style, position);
    const assPath = path.join(tempDir, "captions.ass");
    fs.writeFileSync(assPath, assContent, "utf-8");

    // 5. FFmpeg: burn captions
    const outDir = path.join(env.storagePath, "video", "captioned");
    fs.mkdirSync(outDir, { recursive: true });
    const outFilename = `captioned_${uuidv4()}.mp4`;
    const outPath = path.join(outDir, outFilename);

    // Escape path for FFmpeg ass filter (Windows paths need forward slashes + colon escaped)
    const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    await execFileAsync(env.ffmpegPath, [
      "-i", videoPath,
      "-vf", `ass='${assEscaped}'`,
      "-c:v", "libx264", "-preset", "fast", "-crf", "23",
      "-c:a", "copy",
      "-y", outPath,
    ], { timeout: 180000 });

    const outputUrl = `/api/media/video/captioned/${outFilename}`;
    return NextResponse.json({ ok: true, outputUrl, wordCount: words.length, groupCount: groups.length });
  } catch (e) {
    console.error("[burn-captions]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    // Clean up temp directory
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
