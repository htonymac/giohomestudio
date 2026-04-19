// POST /api/video-finishing — Video Analyzer + Layer Planner
//
// From Support Canvas:
// "Import existing video → analyze → plan layers → review → approve → assemble → export"
//
// Analyzes imported video: duration, audio presence, silence areas, speech detection
// Plans: narration/music/SFX/subtitle/overlay timing
// Returns structured plan ready for Assembly JSON

import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { createEmptyAssembly } from "@/lib/assembly-schema";
import { callPlanner, type ModelTier } from "@/lib/model-tier-router";

const execFileAsync = promisify(execFile);

interface AnalysisResult {
  duration: number;
  hasAudio: boolean;
  audioCodec: string | null;
  videoCodec: string;
  resolution: { width: number; height: number };
  fps: number;
  bitrate: number;
  silenceRegions: Array<{ start: number; end: number }>;
  loudRegions: Array<{ start: number; end: number; volume: number }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoPath, projectTitle, tier } = body as { videoPath: string; projectTitle?: string; tier?: ModelTier };

    if (!videoPath) {
      return NextResponse.json({ error: "No video path provided" }, { status: 400 });
    }

    // Resolve path
    const resolvedPath = videoPath.startsWith("/api/media/")
      ? path.join(env.storagePath, videoPath.replace("/api/media/", ""))
      : videoPath;

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    // ── Step 1: Analyze video with ffprobe ──
    const analysis: AnalysisResult = {
      duration: 0, hasAudio: false, audioCodec: null, videoCodec: "unknown",
      resolution: { width: 0, height: 0 }, fps: 0, bitrate: 0,
      silenceRegions: [], loudRegions: [],
    };

    try {
      // Get format info
      const { stdout: formatInfo } = await execFileAsync(env.ffprobePath, [
        "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", resolvedPath,
      ]);
      const probe = JSON.parse(formatInfo);

      analysis.duration = parseFloat(probe.format?.duration || "0");
      analysis.bitrate = parseInt(probe.format?.bit_rate || "0");

      for (const stream of probe.streams || []) {
        if (stream.codec_type === "video") {
          analysis.videoCodec = stream.codec_name || "unknown";
          analysis.resolution = { width: stream.width || 0, height: stream.height || 0 };
          const fpsStr = stream.r_frame_rate || "30/1";
          const [num, den] = fpsStr.split("/").map(Number);
          analysis.fps = den ? Math.round(num / den) : 30;
        }
        if (stream.codec_type === "audio") {
          analysis.hasAudio = true;
          analysis.audioCodec = stream.codec_name || "aac";
        }
      }
    } catch {
      return NextResponse.json({ error: "Failed to analyze video with ffprobe" }, { status: 500 });
    }

    // ── Step 2: Detect silence regions ──
    try {
      const { stderr: silenceOutput } = await execFileAsync(env.ffmpegPath, [
        "-i", resolvedPath, "-af", "silencedetect=noise=-30dB:d=1", "-f", "null", "-",
      ], { timeout: 30000 });

      const silenceStarts = [...silenceOutput.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
      const silenceEnds = [...silenceOutput.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => parseFloat(m[1]));

      for (let i = 0; i < Math.min(silenceStarts.length, silenceEnds.length); i++) {
        analysis.silenceRegions.push({ start: silenceStarts[i], end: silenceEnds[i] });
      }
    } catch {
      // Silence detection failed — non-critical
    }

    // ── Step 3: Detect volume peaks ──
    try {
      const { stderr: volOutput } = await execFileAsync(env.ffmpegPath, [
        "-i", resolvedPath, "-af", "volumedetect", "-f", "null", "-",
      ], { timeout: 30000 });

      const maxVol = volOutput.match(/max_volume:\s*([-\d.]+)/);
      const meanVol = volOutput.match(/mean_volume:\s*([-\d.]+)/);
      if (maxVol) {
        analysis.loudRegions.push({ start: 0, end: analysis.duration, volume: parseFloat(maxVol[1]) });
      }
    } catch {
      // Volume detection failed — non-critical
    }

    // ── Step 4: AI Layer Planning (Pro+ tier) ──
    let layerPlan = {
      narrationSlots: [] as Array<{ start: number; end: number; suggestion: string }>,
      musicSlots: [] as Array<{ start: number; end: number; mood: string; volume: number }>,
      sfxSlots: [] as Array<{ start: number; event: string; reason: string }>,
      subtitleSlots: [] as Array<{ start: number; end: number; text: string }>,
      overlaySlots: [] as Array<{ start: number; end: number; type: string; content: string }>,
    };

    const modelTier = (tier as ModelTier) || "pro";

    if (modelTier !== "standard") {
      const prompt = `Analyze this video and plan audio/visual layers:

Video: ${projectTitle || "Imported video"}
Duration: ${analysis.duration.toFixed(1)}s
Has audio: ${analysis.hasAudio}
Resolution: ${analysis.resolution.width}x${analysis.resolution.height}
Silence regions: ${analysis.silenceRegions.length > 0 ? analysis.silenceRegions.map(s => `${s.start.toFixed(1)}s-${s.end.toFixed(1)}s`).join(", ") : "none detected"}

Plan these layers:
1. narrationSlots: where narration would work well (especially in silence)
2. musicSlots: background music sections with mood and volume (0-1)
3. sfxSlots: sound effects that would enhance the video
4. subtitleSlots: where subtitles should appear
5. overlaySlots: logo, CTA, or text overlay positions

Return ONLY valid JSON with these 5 arrays. Keep it practical.`;

      const system = "You are the GHS Video Finishing AI. Plan audio and visual layers for an imported video. Return ONLY JSON.";
      const result = await callPlanner(prompt, system, modelTier);

      if (result.ok) {
        try {
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.narrationSlots) layerPlan.narrationSlots = parsed.narrationSlots;
            if (parsed.musicSlots) layerPlan.musicSlots = parsed.musicSlots;
            if (parsed.sfxSlots) layerPlan.sfxSlots = parsed.sfxSlots;
            if (parsed.subtitleSlots) layerPlan.subtitleSlots = parsed.subtitleSlots;
            if (parsed.overlaySlots) layerPlan.overlaySlots = parsed.overlaySlots;
          }
        } catch { /* AI returned non-JSON */ }
      }
    }

    // ── Step 5: Create Assembly JSON skeleton ──
    const assembly = createEmptyAssembly(
      `finish_${Date.now()}`,
      "video_finishing",
      projectTitle || "Finished Video",
    );
    assembly.totalDuration = analysis.duration;
    assembly.resolution = analysis.resolution;
    assembly.aspectRatio = analysis.resolution.width > analysis.resolution.height ? "16:9" : analysis.resolution.height > analysis.resolution.width ? "9:16" : "1:1";
    assembly.plannerTier = modelTier;

    // Add the source video as the main segment
    assembly.segments.push({
      id: "seg_source",
      type: "video",
      sourceUrl: resolvedPath,
      startTime: 0,
      endTime: analysis.duration,
      duration: analysis.duration,
      transitionIn: "cut",
      transitionOut: "cut",
    });

    return NextResponse.json({
      analysis,
      layerPlan,
      assembly,
      meta: {
        tier: modelTier,
        silenceCount: analysis.silenceRegions.length,
        narrationSuggestions: layerPlan.narrationSlots.length,
        musicSuggestions: layerPlan.musicSlots.length,
        sfxSuggestions: layerPlan.sfxSlots.length,
      },
    });
  } catch (err) {
    console.error("Video finishing error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video analysis failed" },
      { status: 500 }
    );
  }
}
