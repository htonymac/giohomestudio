// POST /api/assembly/preview — Draft Quality Preview from Assembly JSON
//
// Generates a low-resolution preview so the user can review before committing
// to a full render. Uses the same Assembly JSON → FFmpeg pipeline but with
// draft settings (lower resolution, faster encoding, no credits overlay).
//
// This is the "preview render from JSON before final render" from Support Canvas.

import { NextRequest, NextResponse } from "next/server";
import type { AssemblyJSON } from "@/lib/assembly-schema";
import { estimateAssemblyCost } from "@/lib/assembly-builder";
import { env } from "@/config/env";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body: { assembly: AssemblyJSON } = await req.json();
    const { assembly } = body;

    if (!assembly?.segments?.length) {
      return NextResponse.json({ error: "Assembly JSON has no segments" }, { status: 400 });
    }

    const previewDir = path.join(env.storagePath, "video", "preview", `prev_${assembly.projectId}_${Date.now()}`);
    fs.mkdirSync(previewDir, { recursive: true });

    const ffmpeg = env.ffmpegPath;

    // ── Draft settings: 480p, fast encoding ──
    const draftWidth = assembly.aspectRatio === "9:16" ? 270 : 480;
    const draftHeight = assembly.aspectRatio === "9:16" ? 480 : 270;

    // ── Step 1: Concat available segments at draft quality ──
    const availableSegments = assembly.segments
      .sort((a, b) => a.startTime - b.startTime)
      .filter(s => {
        const resolved = resolveMediaPath(s.sourceUrl);
        return resolved && fs.existsSync(resolved);
      });

    if (availableSegments.length === 0) {
      // No rendered segments yet — generate a placeholder timeline
      return NextResponse.json({
        success: false,
        message: "No rendered segments available for preview. Render scenes first.",
        timeline: assembly.segments.map(s => ({
          id: s.id,
          type: s.type,
          startTime: s.startTime,
          endTime: s.endTime,
          hasSource: false,
        })),
        cost: estimateAssemblyCost(assembly),
      });
    }

    // Write concat file
    const concatContent = availableSegments
      .map(s => `file '${resolveMediaPath(s.sourceUrl).replace(/\\/g, "/")}'`)
      .join("\n");
    const concatFile = path.join(previewDir, "concat.txt");
    fs.writeFileSync(concatFile, concatContent);

    // Concat + scale to draft resolution
    const concatOutput = path.join(previewDir, "preview_raw.mp4");
    try {
      await execFileAsync(ffmpeg, [
        "-f", "concat", "-safe", "0", "-i", concatFile,
        "-vf", `scale=${draftWidth}:${draftHeight}:force_original_aspect_ratio=decrease,pad=${draftWidth}:${draftHeight}:(ow-iw)/2:(oh-ih)/2`,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-c:a", "aac", "-b:a", "64k",
        "-movflags", "+faststart",
        "-y", concatOutput,
      ], { timeout: 60000 });
    } catch (err) {
      // Try copy mode if re-encode fails
      try {
        await execFileAsync(ffmpeg, [
          "-f", "concat", "-safe", "0", "-i", concatFile,
          "-c", "copy",
          "-movflags", "+faststart",
          "-y", concatOutput,
        ], { timeout: 60000 });
      } catch {
        return NextResponse.json({ error: "Preview concat failed" }, { status: 500 });
      }
    }

    // ── Step 2: Add music if available ──
    let finalPreview = concatOutput;
    if (assembly.music.length > 0) {
      const musicEntry = assembly.music[0];
      const musicPath = resolveMediaPath(musicEntry.sourceUrl);

      if (musicPath && fs.existsSync(musicPath)) {
        const withMusic = path.join(previewDir, "preview_with_music.mp4");
        try {
          await execFileAsync(ffmpeg, [
            "-i", concatOutput,
            "-i", musicPath,
            "-filter_complex",
            `[1:a]volume=${musicEntry.volume}[mus];[0:a][mus]amix=inputs=2:duration=first[aout]`,
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "96k",
            "-shortest",
            "-y", withMusic,
          ], { timeout: 60000 });
          finalPreview = withMusic;
        } catch {
          // Music mix failed, use video-only preview
        }
      }
    }

    // ── Step 3: Add "PREVIEW" watermark ──
    const watermarked = path.join(previewDir, "preview_final.mp4");
    try {
      await execFileAsync(ffmpeg, [
        "-i", finalPreview,
        "-vf", `drawtext=text='PREVIEW':fontsize=24:fontcolor=white@0.5:x=(w-text_w)/2:y=h-40`,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-c:a", "copy",
        "-y", watermarked,
      ], { timeout: 60000 });
      finalPreview = watermarked;
    } catch {
      // Watermark failed, use unwatermarked preview
    }

    if (!fs.existsSync(finalPreview)) {
      return NextResponse.json({ error: "Preview generation failed" }, { status: 500 });
    }

    // Get duration
    let duration = assembly.totalDuration;
    try {
      const { stdout } = await execFileAsync(env.ffprobePath, [
        "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", finalPreview,
      ]);
      duration = parseFloat(stdout.trim()) || duration;
    } catch { /* use estimated */ }

    const previewUrl = `/api/media/${path.relative(env.storagePath, finalPreview).replace(/\\/g, "/")}`;

    // Update Assembly Record preview status
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.assemblyRecord.updateMany({
        where: { projectId: assembly.projectId },
        data: { previewStatus: "completed" },
      });
    } catch { /* ignore */ }

    // Clean up intermediate files
    for (const f of ["concat.txt", "preview_raw.mp4", "preview_with_music.mp4"]) {
      const fp = path.join(previewDir, f);
      if (fp !== finalPreview && fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      success: true,
      previewUrl,
      duration,
      resolution: `${draftWidth}x${draftHeight}`,
      quality: "draft",
      segmentsIncluded: availableSegments.length,
      segmentsTotal: assembly.segments.length,
      hasMusicMix: finalPreview.includes("music"),
      cost: estimateAssemblyCost(assembly),
      timeline: assembly.segments.map(s => ({
        id: s.id,
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        hasSource: availableSegments.some(as => as.id === s.id),
      })),
    });
  } catch (err) {
    console.error("Assembly preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview generation failed" },
      { status: 500 }
    );
  }
}

function resolveMediaPath(url: string): string {
  if (!url) return "";
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  if (url.startsWith("/api/media/")) {
    return path.join(env.storagePath, url.replace("/api/media/", ""));
  }
  if (url.startsWith("/storage/")) {
    return path.join(env.storagePath, url.replace("/storage/", ""));
  }
  return url;
}
