// POST /api/video/thumbnail — Generate thumbnail from video or AI prompt
//
// Two modes:
// 1. Extract frame from existing video (FFmpeg — free, instant)
// 2. Generate AI thumbnail from prompt (fal.ai Flux — 1 credit)
//
// Input: { videoUrl, timeSeconds, prompt, width, height, mode }
// Output: { thumbnailUrl } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl, timeSeconds, prompt, width, height, mode } = body;

    const outDir = path.join(env.storagePath, "thumbnails");
    fs.mkdirSync(outDir, { recursive: true });

    // ── Mode 1: Extract frame from video (default) ──
    if (mode !== "ai" && videoUrl) {
      const videoPath = resolveMediaPath(videoUrl);
      if (!videoPath || !fs.existsSync(videoPath)) {
        return NextResponse.json({ error: "Video file not found" }, { status: 404 });
      }

      const time = timeSeconds ?? 2; // default: grab frame at 2 seconds
      const outPath = path.join(outDir, `thumb_${Date.now()}.jpg`);

      try {
        await execFileAsync(env.ffmpegPath, [
          "-ss", String(time),
          "-i", videoPath,
          "-vframes", "1",
          "-vf", `scale=${width ?? 640}:${height ?? 360}:force_original_aspect_ratio=decrease,pad=${width ?? 640}:${height ?? 360}:(ow-iw)/2:(oh-ih)/2:color=black`,
          "-q:v", "2",
          "-y", outPath,
        ], { timeout: 15000 });

        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        return NextResponse.json({
          thumbnailUrl: `/api/media/${relPath}`,
          mode: "extract",
          timeSeconds: time,
        });
      } catch (e) {
        return NextResponse.json({ error: `FFmpeg frame extract failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
      }
    }

    // ── Mode 2: AI-generated thumbnail ──
    if (mode === "ai" && prompt) {
      const FAL_KEY = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
      if (!FAL_KEY) {
        return NextResponse.json({ error: "FAL API key not set" }, { status: 503 });
      }

      try {
        const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Thumbnail poster: ${prompt}. High quality, eye-catching, professional, 16:9 aspect ratio`,
            image_size: { width: width ?? 1280, height: height ?? 720 },
            num_inference_steps: 4,
          }),
        });

        if (!res.ok) {
          return NextResponse.json({ error: `Flux returned ${res.status}` }, { status: 502 });
        }

        const data = await res.json();
        const imgUrl = data.images?.[0]?.url;
        if (!imgUrl) {
          return NextResponse.json({ error: "No image returned" }, { status: 502 });
        }

        const imgRes = await fetch(imgUrl);
        const outPath = path.join(outDir, `thumb_ai_${Date.now()}.jpg`);
        fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));

        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        return NextResponse.json({
          thumbnailUrl: `/api/media/${relPath}`,
          mode: "ai",
          credits: 1,
        });
      } catch (e) {
        return NextResponse.json({ error: `AI thumbnail failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Provide videoUrl (for extract) or prompt+mode=ai (for AI generation)" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

function resolveMediaPath(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/media\/(.+)/);
  if (match) return path.join(env.storagePath, match[1].replace(/\//g, path.sep));
  if (fs.existsSync(url)) return url;
  const storagePath = path.join(env.storagePath, url);
  if (fs.existsSync(storagePath)) return storagePath;
  return null;
}
