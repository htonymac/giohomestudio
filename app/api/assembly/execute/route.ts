// POST /api/assembly/execute — Assembly JSON → FFmpeg Render
//
// Preprocessing: downloads external images, converts images → video clips,
// strips img: prefix, then runs the standard FFmpeg concat pipeline.

import { NextRequest, NextResponse } from "next/server";
import { buildAssemblyPlan, estimateAssemblyCost } from "@/lib/assembly-builder";
import type { AssemblyJSON, AssemblySegment } from "@/lib/assembly-schema";
import { audit } from "@/lib/audit";
import { env } from "@/config/env";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ── Helper: Resolve media URL → local absolute path ──
function resolveMediaPath(url: string): string {
  if (!url) return "";
  const stripped = url.replace(/^img:/, "").replace(/^bg:[^)]+\)$/, "");
  if (path.isAbsolute(stripped) && fs.existsSync(stripped)) return stripped;
  if (stripped.startsWith("/api/media/")) {
    return path.join(env.storagePath, stripped.replace("/api/media/", ""));
  }
  if (stripped.startsWith("/storage/")) {
    return path.join(env.storagePath, stripped.replace("/storage/", ""));
  }
  return stripped;
}

// ── Helper: Download external URL to a local temp file ──
async function downloadToFile(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 0;
  } catch {
    return false;
  }
}

// Shared video normalization filter — all clips must match for concat to work
const NORMALIZE_FILTER = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1";

// ── Helper: Convert image → short video clip ──
async function imageToVideoClip(imagePath: string, duration: number, outputPath: string): Promise<boolean> {
  try {
    await execFileAsync(env.ffmpegPath, [
      "-loop", "1",
      "-i", imagePath,
      "-t", String(duration),
      "-vf", NORMALIZE_FILTER,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", outputPath,
    ], { timeout: 60000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch {
    return false;
  }
}

// ── Helper: Transcode existing video to normalized format ──
async function transcodeVideoClip(videoPath: string, duration: number, outputPath: string): Promise<boolean> {
  try {
    const args = [
      "-i", videoPath,
      "-t", String(duration),
      "-vf", NORMALIZE_FILTER,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", outputPath,
    ];
    await execFileAsync(env.ffmpegPath, args, { timeout: 120000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch {
    return false;
  }
}

// ── Preprocess segments: normalize URLs, download externals, images → clips ──
async function preprocessSegments(
  segments: AssemblySegment[],
  outputDir: string
): Promise<Map<string, string>> {
  // Returns: Map<segment.id, localVideoPath>
  const resolved = new Map<string, string>();

  for (const seg of segments) {
    const rawUrl = seg.sourceUrl || "";

    // Strip img: prefix
    const url = rawUrl.replace(/^img:/, "");

    // Skip gradient backgrounds
    if (!url || url.startsWith("bg:") || url.startsWith("linear-gradient")) {
      console.log(`[assembly] ${seg.sceneId}: skipped (gradient/empty)`);
      continue;
    }

    const duration = seg.duration || 5;
    const clipPath = path.join(outputDir, `clip_${seg.id}.mp4`);

    // Already a video file (no img: prefix on original)?
    const isVideo = !rawUrl.startsWith("img:") && (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov"));

    if (isVideo) {
      const localPath = resolveMediaPath(url);
      if (fs.existsSync(localPath)) {
        // Transcode to normalized format so concat is compatible
        const ok = await transcodeVideoClip(localPath, duration, clipPath);
        if (ok) {
          resolved.set(seg.id, clipPath);
          console.log(`[assembly] ${seg.sceneId}: video transcoded OK`);
        } else {
          // Fallback: use original if transcode fails
          resolved.set(seg.id, localPath);
          console.log(`[assembly] ${seg.sceneId}: video transcode failed, using original`);
        }
        continue;
      }
      // External video URL — skip (too large to download)
      console.log(`[assembly] ${seg.sceneId}: video not local, skipping`);
      continue;
    }

    // Image segment — need to convert to video clip
    let localImagePath = resolveMediaPath(url);

    // External URL? Download first
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const ext = url.includes(".png") ? ".png" : url.includes(".webp") ? ".webp" : ".jpg";
      const downloadPath = path.join(outputDir, `dl_${seg.id}${ext}`);
      const ok = await downloadToFile(url, downloadPath);
      if (!ok) {
        console.log(`[assembly] ${seg.sceneId}: download failed for ${url.slice(0, 80)}`);
        continue;
      }
      localImagePath = downloadPath;
      console.log(`[assembly] ${seg.sceneId}: downloaded external image`);
    }

    if (!fs.existsSync(localImagePath)) {
      console.log(`[assembly] ${seg.sceneId}: image not found: ${localImagePath}`);
      continue;
    }

    // Convert image → video clip
    const ok = await imageToVideoClip(localImagePath, duration, clipPath);
    if (ok) {
      resolved.set(seg.id, clipPath);
      console.log(`[assembly] ${seg.sceneId}: image→video OK (${duration}s)`);
    } else {
      console.log(`[assembly] ${seg.sceneId}: image→video FAILED`);
    }
  }

  return resolved;
}

export async function POST(req: NextRequest) {
  try {
    const body: { assembly: AssemblyJSON; skipApprovalCheck?: boolean } = await req.json();
    let assembly = body.assembly;

    if (!assembly?.segments?.length) {
      return NextResponse.json({ error: "Assembly JSON has no segments" }, { status: 400 });
    }

    // ── Gate: Rights and approval checks ──
    if (!body.skipApprovalCheck) {
      if (assembly.soundLicenses.some(l => l.license === "cc_by" && !l.attribution)) {
        return NextResponse.json(
          { error: "CC BY sounds require attribution text before export" },
          { status: 400 }
        );
      }
    }

    // ── Normalize segment durations if old data has duration:5 fallbacks ──
    // If sum of all segment durations is < 50% of totalDuration, the planner used
    // hardcoded 5s defaults. Redistribute totalDuration evenly so images show long enough.
    if (assembly.totalDuration > 0 && assembly.segments.length > 0) {
      const segDurSum = assembly.segments.reduce((sum, s) => sum + (s.duration || 5), 0);
      if (segDurSum < assembly.totalDuration * 0.5) {
        const durPerSeg = assembly.totalDuration / assembly.segments.length;
        assembly = { ...assembly, segments: assembly.segments.map(s => ({ ...s, duration: durPerSeg })) };
      }
    }

    // ── Prepare output directory ──
    const outputDir = path.join(env.storagePath, "video", "assembly", `${assembly.projectId}_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    // ── Preprocess: download externals + images → video clips ──
    console.log(`[assembly] Preprocessing ${assembly.segments.length} segments...`);
    const segmentVideoMap = await preprocessSegments(
      assembly.segments.sort((a, b) => a.startTime - b.startTime),
      outputDir
    );

    if (segmentVideoMap.size === 0) {
      return NextResponse.json({ error: "No valid media segments after preprocessing. All images/videos unavailable." }, { status: 400 });
    }

    // ── Patch assembly segments with resolved local paths ──
    const patchedSegments = assembly.segments
      .sort((a, b) => a.startTime - b.startTime)
      .filter(s => segmentVideoMap.has(s.id))
      .map(s => ({ ...s, type: "video" as const, sourceUrl: segmentVideoMap.get(s.id)! }));

    const patchedAssembly: AssemblyJSON = {
      ...assembly,
      segments: patchedSegments,
    };

    // ── Write concat list — use only basenames so FFmpeg resolves relative to concat file dir ──
    if (patchedSegments.length > 0) {
      const concatContent = patchedSegments
        .map(s => `file '${path.basename(s.sourceUrl)}'`)
        .join("\n");
      fs.writeFileSync(path.join(outputDir, "concat_list.txt"), concatContent);
      console.log(`[assembly] Concat list: ${patchedSegments.length} clips → ${concatContent.slice(0, 120)}`);
    }

    // ── Resolve narration audio paths ──
    const patchedNarration = patchedAssembly.narration.map(n => ({
      ...n,
      audioUrl: n.audioUrl ? resolveMediaPath(n.audioUrl) : undefined,
    })).filter(n => n.audioUrl && fs.existsSync(n.audioUrl));

    // ── Resolve music paths ──
    const patchedMusic = patchedAssembly.music.map(m => ({
      ...m,
      sourceUrl: resolveMediaPath(m.sourceUrl),
    })).filter(m => m.sourceUrl && fs.existsSync(m.sourceUrl));

    const finalAssembly: AssemblyJSON = {
      ...patchedAssembly,
      narration: patchedNarration,
      music: patchedMusic,
    };

    // ── Resolve SFX paths ──
    const patchedSfx = finalAssembly.sfx
      .map(s => ({ ...s, sourceUrl: resolveMediaPath(s.sourceUrl) }))
      .filter(s => s.sourceUrl && fs.existsSync(s.sourceUrl));

    // ── Pre-flight: correct totalDuration via ffprobe on narration files ──────
    // page.tsx sends totalDuration = sum(motionDuration) ≈ 30s when React
    // narratorAudioDuration state reset to 0 after a hard page refresh.
    // That makes prepare_music loop music to only 30s while narration is 3min.
    // Fix: probe the actual narration audio BEFORE building the plan.
    let fullAssembly: AssemblyJSON = { ...finalAssembly, sfx: patchedSfx };
    {
      const ffprobePath = env.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
      const longestNarr = patchedNarration.reduce((best: typeof patchedNarration[0] | null, n) =>
        n.audioUrl && (!best || (n.endTime || 0) > (best.endTime || 0)) ? n : best,
        null
      );
      if (longestNarr?.audioUrl && fs.existsSync(longestNarr.audioUrl)) {
        try {
          const { stdout } = await execFileAsync(ffprobePath,
            ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", longestNarr.audioUrl],
            { timeout: 8000 }
          );
          const realDur = parseFloat(stdout.trim());
          if (realDur > 0 && realDur > fullAssembly.totalDuration) {
            console.log(`[assembly] totalDuration corrected ${fullAssembly.totalDuration.toFixed(1)}s → ${realDur.toFixed(1)}s (ffprobe narration)`);
            fullAssembly = { ...fullAssembly, totalDuration: realDur };
          }
        } catch { /* ffprobe unavailable — keep declared totalDuration */ }
      }
    }

    // ── Build FFmpeg execution plan ──
    const steps = buildAssemblyPlan(fullAssembly, outputDir);

    if (steps.length === 0) {
      return NextResponse.json({ error: "No FFmpeg steps generated from assembly" }, { status: 400 });
    }

    console.log(`[assembly] FFmpeg plan: ${steps.map(s => s.id).join(" → ")}`);

    // ── Execute steps in dependency order ──
    const results: Array<{ id: string; status: string; duration?: number; error?: string }> = [];
    const completedSteps = new Set<string>();

    for (const step of steps) {
      // Check dependencies — for final_merge, only require concat_segments (audio is optional)
      if (step.dependsOn?.length) {
        const hardDeps = step.id === "final_merge"
          ? step.dependsOn.filter(d => d === "concat_segments")  // only video is required
          : step.dependsOn;
        const missingDeps = hardDeps.filter(d => !completedSteps.has(d));
        if (missingDeps.length > 0) {
          results.push({ id: step.id, status: "skipped", error: `Missing deps: ${missingDeps.join(", ")}` });
          continue;
        }
      }

      // For final_merge: rebuild command dynamically — audio is optional, only video is required
      if (step.id === "final_merge") {
        const concatRaw = path.join(outputDir, "concat_raw.mp4");
        const narrationWav = path.join(outputDir, "narration_mix.wav");
        const musicWav = path.join(outputDir, "music_mix.wav");
        if (!fs.existsSync(concatRaw)) {
          results.push({ id: step.id, status: "skipped", error: "concat_raw.mp4 missing — cannot merge" });
          console.log(`[assembly] final_merge SKIPPED — no concat_raw.mp4`);
          continue;
        }
        const sfxWav = path.join(outputDir, "sfx_mix.wav");
        const hasNarr = fs.existsSync(narrationWav);
        const hasMus = fs.existsSync(musicWav);
        const hasSfx = fs.existsSync(sfxWav);
        const duckLevel = fullAssembly.duckingRules?.musicDuckLevel ?? 0.08;
        // totalDuration was already corrected by pre-flight ffprobe above
        const totalDur = fullAssembly.totalDuration || 60;
        const finalOut = step.outputPath;
        let cmd: string[];
        // Always stream_loop the concat video to fill totalDuration — safety net for short clips.
        // Re-encode (libx264 veryfast) is required when using -stream_loop.
        if (!hasNarr && !hasMus && !hasSfx) {
          cmd = [env.ffmpegPath, "-stream_loop", "-1", "-i", concatRaw, "-t", String(totalDur), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", "-y", finalOut];
        } else {
          const inputs: string[] = ["-stream_loop", "-1", "-i", concatRaw];
          const filters: string[] = [];
          const audioSrcs: string[] = [];
          let idx = 1;
          if (hasNarr) { inputs.push("-i", narrationWav); filters.push(`[${idx}:a]volume=1.0[narr]`);          audioSrcs.push("[narr]"); idx++; }
          if (hasMus)  { inputs.push("-i", musicWav);     filters.push(`[${idx}:a]volume=0.4[mus]`); audioSrcs.push("[mus]");  idx++; }
          if (hasSfx)  { inputs.push("-i", sfxWav);       filters.push(`[${idx}:a]volume=0.6[sfx]`);          audioSrcs.push("[sfx]");  idx++; }
          const mixFilter = filters.join(";") + ";" + audioSrcs.join("") + `amix=inputs=${audioSrcs.length}:duration=longest:normalize=0[fa]`;
          cmd = [env.ffmpegPath, ...inputs, "-t", String(totalDur), "-filter_complex", mixFilter, "-map", "0:v", "-map", "[fa]", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-y", finalOut];
        }
        console.log(`[assembly] final_merge — video+narr=${hasNarr} music=${hasMus} sfx=${hasSfx} dur=${totalDur}s`);
        try {
          const startMs = Date.now();
          await execFileAsync(cmd[0], cmd.slice(1), { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });
          const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
          if (fs.existsSync(finalOut)) {
            completedSteps.add(step.id);
            results.push({ id: step.id, status: "completed", duration: parseFloat(elapsed) });
            console.log(`[assembly] final_merge DONE (${elapsed}s)`);
          } else {
            results.push({ id: step.id, status: "failed", error: "final output not created" });
          }
        } catch (mergeErr) {
          const msg = mergeErr instanceof Error ? mergeErr.message.slice(0, 400) : "FFmpeg merge error";
          results.push({ id: step.id, status: "failed", error: msg });
          console.error(`[assembly] final_merge ERROR:`, msg);
        }
        continue;
      }

      // Check if input files exist
      const inputArgs = step.command.filter((_, i, arr) => arr[i - 1] === "-i");
      const missingInputs = inputArgs.filter(p => !fs.existsSync(p));
      if (missingInputs.length > 0 && step.id !== "concat_segments") {
        results.push({ id: step.id, status: "skipped", error: `Missing inputs: ${missingInputs.join(", ").slice(0, 200)}` });
        console.log(`[assembly] ${step.id} SKIPPED — missing: ${missingInputs.join(", ").slice(0, 200)}`);
        continue;
      }

      try {
        const startMs = Date.now();
        const [cmd, ...args] = step.command;
        console.log(`[assembly] Running: ${step.id}...`);
        await execFileAsync(cmd, args, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

        if (fs.existsSync(step.outputPath)) {
          completedSteps.add(step.id);
          results.push({ id: step.id, status: "completed", duration: parseFloat(elapsed) });
          console.log(`[assembly] ${step.id} DONE (${elapsed}s)`);
        } else {
          results.push({ id: step.id, status: "failed", error: "Output file not created" });
          console.log(`[assembly] ${step.id} FAILED — no output`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message.slice(0, 400) : "FFmpeg error";
        results.push({ id: step.id, status: "failed", error: errMsg });
        console.error(`[assembly] ${step.id} ERROR:`, errMsg);
      }
    }

    // ── Subtitle burn-in (optional, graceful — skipped if FFmpeg lacks libass or no text) ──
    // Generates an SRT from narration text, burns it on top of the final output.
    // Failure here NEVER blocks the output — original video is always preserved.
    let subtitledOutputPath = "";
    if (assembly.exportSettings?.includeSubtitles) {
      const narrationWithText = fullAssembly.narration.filter(n => n.text && n.text.trim());
      if (narrationWithText.length > 0) {
        try {
          // Build SRT from narration entries — split text into sentences, time proportionally
          function buildSRT(entries: typeof narrationWithText): string {
            function toSRTTime(sec: number): string {
              const h = Math.floor(sec / 3600);
              const m = Math.floor((sec % 3600) / 60);
              const s = Math.floor(sec % 60);
              const ms = Math.round((sec % 1) * 1000);
              return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
            }
            const lines: string[] = [];
            let idx = 1;
            for (const entry of entries) {
              const text = entry.text!.trim();
              const dur = Math.max((entry.endTime || 0) - (entry.startTime || 0), 1);
              // Split into sentences (~40 chars per subtitle card max)
              const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
              const totalChars = text.length || 1;
              let charsCursor = 0;
              for (const sentence of sentences) {
                const s = sentence.trim();
                if (!s) continue;
                const startFrac = charsCursor / totalChars;
                const endFrac = Math.min((charsCursor + s.length) / totalChars, 1);
                const start = (entry.startTime || 0) + startFrac * dur;
                const end = (entry.startTime || 0) + endFrac * dur;
                lines.push(`${idx}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${s}\n`);
                idx++;
                charsCursor += s.length;
              }
            }
            return lines.join("\n");
          }
          const srtContent = buildSRT(narrationWithText);
          const srtPath = path.join(outputDir, "subtitles.srt");
          fs.writeFileSync(srtPath, srtContent, "utf-8");

          const finalMergeStep = steps.find(s => s.id === "final_merge");
          const unsub = finalMergeStep?.outputPath || "";
          if (unsub && fs.existsSync(unsub)) {
            const subbedPath = unsub.replace(".mp4", "_subtitled.mp4");
            // subtitles= filter requires libass — fails gracefully if not compiled in
            await execFileAsync(env.ffmpegPath, [
              "-i", unsub,
              "-vf", `subtitles=${srtPath.replace(/\\/g, "/")}:force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2'`,
              "-c:a", "copy",
              "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
              "-movflags", "+faststart",
              "-y", subbedPath,
            ], { timeout: 180000 });
            if (fs.existsSync(subbedPath) && fs.statSync(subbedPath).size > 0) {
              subtitledOutputPath = subbedPath;
              console.log(`[assembly] Subtitle burn-in OK → ${path.basename(subbedPath)}`);
            }
          }
        } catch (subErr) {
          // Subtitle burn failed (likely missing libass) — continue with original output
          console.warn("[assembly] Subtitle burn-in skipped:", subErr instanceof Error ? subErr.message.slice(0, 200) : subErr);
        }
      }
    }

    // ── Find final output ──
    const finalStep = steps.find(s => s.id === "final_merge");
    // Use subtitled output if burn-in succeeded, otherwise use raw final merge
    const finalOutputPath = subtitledOutputPath || finalStep?.outputPath || "";
    const outputExists = finalOutputPath && fs.existsSync(finalOutputPath);

    // ── Get duration via ffprobe ──
    let finalDuration = assembly.totalDuration;
    if (outputExists) {
      try {
        const { stdout } = await execFileAsync(env.ffprobePath, [
          "-v", "quiet", "-show_entries", "format=duration",
          "-of", "csv=p=0", finalOutputPath,
        ]);
        finalDuration = parseFloat(stdout.trim()) || assembly.totalDuration;
      } catch {
        // Use estimated duration
      }
    }

    // ── Generate thumbnail ──
    let thumbnailUrl = "";
    if (outputExists) {
      try {
        const thumbPath = path.join(outputDir, "thumbnail.jpg");
        const thumbTime = Math.min(finalDuration * 0.3, 5);
        await execFileAsync(env.ffmpegPath, [
          "-i", finalOutputPath,
          "-ss", String(thumbTime),
          "-vframes", "1",
          "-q:v", "3",
          "-y", thumbPath,
        ]);
        if (fs.existsSync(thumbPath)) {
          thumbnailUrl = `/api/media/${path.relative(env.storagePath, thumbPath).replace(/\\/g, "/")}`;
        }
      } catch {
        // Thumbnail optional
      }
    }

    // ── Save to Asset Library ──
    let assetUrl = "";
    if (outputExists) {
      assetUrl = `/api/media/${path.relative(env.storagePath, finalOutputPath).replace(/\\/g, "/")}`;

      try {
        const { saveVideoAsset } = await import("@/lib/save-video-asset");
        saveVideoAsset({
          filePath: finalOutputPath,
          title: assembly.title || "Assembled Video",
          source: assembly.projectId?.includes("children") ? "children_planner" : assembly.projectId?.includes("movie") ? "movie_planner" : "hybrid_planner",
          durationSeconds: finalDuration,
          tags: ["assembled", "planner", "video"],
        });
      } catch { /* non-blocking */ }

      try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.contentItem.create({
          data: {
            originalInput: assembly.title || "Assembly Output",
            status: "APPROVED",
            outputMode: "hybrid",
            mergedOutputPath: finalOutputPath,
            durationSeconds: Math.round(finalDuration),
            notes: `Assembly: ${assembly.segments.length} segments, ${assembly.narration.length} narration, ${assembly.music.length} music. Tier: ${assembly.plannerTier}`,
          },
        });
      } catch {
        // DB save failed — output still usable
      }

      try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.assemblyRecord.updateMany({
          where: { projectId: assembly.projectId },
          data: { renderStatus: "completed" },
        });
      } catch {
        // DB update failed
      }
    }

    // ── Cost estimate ──
    const cost = estimateAssemblyCost(assembly);

    // ── Audit log ──
    if (outputExists) {
      audit.renderCompleted(assembly.projectId, finalOutputPath);
      audit.assemblyCompleted(assembly.projectId, assembly.version);
    } else {
      audit.renderStarted(assembly.projectId, assembly.plannerTier);
    }

    // ── Clean up intermediate files (keep final + thumbnail) ──
    const intermediateFiles = ["concat_raw.mp4", "narration_mix.wav", "music_mix.wav", "sfx_mix.wav", "concat_list.txt"];
    for (const f of intermediateFiles) {
      const fp = path.join(outputDir, f);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      success: outputExists,
      outputUrl: assetUrl,
      outputPath: finalOutputPath,
      thumbnailUrl,
      duration: finalDuration,
      steps: results,
      cost,
      assembly: {
        projectId: assembly.projectId,
        version: assembly.version,
        tier: assembly.plannerTier,
        segments: patchedSegments.length,
        narration: finalAssembly.narration.length,
        music: finalAssembly.music.length,
        sfx: fullAssembly.sfx.length,
      },
    });
  } catch (err) {
    console.error("Assembly execute error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assembly execution failed" },
      { status: 500 }
    );
  }
}
