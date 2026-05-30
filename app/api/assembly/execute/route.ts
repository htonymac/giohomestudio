// POST /api/assembly/execute — Assembly JSON → FFmpeg Render
//
// Preprocessing: downloads external images, converts images → video clips,
// strips img: prefix, then runs the standard FFmpeg concat pipeline.

import { NextRequest, NextResponse } from "next/server";
import { buildAssemblyPlan, estimateAssemblyCost, computeNarratorWindows } from "@/lib/assembly-builder";
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
      // ultrafast: these are INTERMEDIATE clips that get re-encoded at final_merge anyway,
      // so encode quality here is irrelevant — only speed matters. default "medium" preset
      // made 70 image encodes the assembly bottleneck. (2026-05-28 perf)
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", outputPath,
    ], { timeout: 60000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 2000; // >2KB — reject empty/48-byte clips that pass a bare >0 check and corrupt concat
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
      "-preset", "ultrafast", // intermediate clip — re-encoded at final_merge (2026-05-28 perf)
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", outputPath,
    ];
    await execFileAsync(env.ffmpegPath, args, { timeout: 120000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 2000; // >2KB — reject empty/48-byte clips that pass a bare >0 check and corrupt concat
  } catch {
    return false;
  }
}

// ── Helper: build a VALID solid-color placeholder clip ──
// Used whenever a scene's image is missing or its conversion produced an empty clip
// (e.g. image generation was down). Keeps the scene visible + the timeline/narration
// aligned instead of dropping the segment (which corrupted/shifted the video). 2026-05-28
async function solidPlaceholderClip(clipPath: string, duration: number): Promise<boolean> {
  try {
    await execFileAsync(env.ffmpegPath, [
      "-f", "lavfi", "-i", "color=c=#0a0d14:size=1920x1080:rate=30",
      "-t", String(duration),
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", "-y", clipPath,
    ], { timeout: 30000 });
    return fs.existsSync(clipPath) && fs.statSync(clipPath).size > 2000;
  } catch {
    return false;
  }
}

// ── Preprocess one segment (extracted for parallel execution) ──
async function preprocessOneSegment(
  seg: AssemblySegment,
  outputDir: string
): Promise<{ id: string; clipPath: string; placeholder?: boolean } | null> {
  const rawUrl = seg.sourceUrl || "";
  const url = rawUrl.replace(/^img:/, "");

  if (!url || url.startsWith("bg:") || url.startsWith("linear-gradient")) {
    // No image yet — generate solid dark background clip so this scene isn't silently dropped
    const duration = Math.max(Number(seg.duration) || 5, 1); // min 1s — a ~0 duration made ffmpeg emit empty 48-byte clips that corrupted the concat (2026-05-28)
    const clipPath = path.join(outputDir, `clip_${seg.id}.mp4`);
    if (await solidPlaceholderClip(clipPath, duration)) {
      console.log(`[assembly] ${seg.sceneId}: gradient → solid bg clip (${duration}s)`);
      return { id: seg.id, clipPath, placeholder: true };
    }
    console.log(`[assembly] ${seg.sceneId}: skipped (gradient/empty, ffmpeg color failed)`);
    return null;
  }

  const duration = Math.max(Number(seg.duration) || 5, 1); // min 1s — a ~0 duration made ffmpeg emit empty 48-byte clips that corrupted the concat (2026-05-28)
  const clipPath = path.join(outputDir, `clip_${seg.id}.mp4`);
  const isVideo = !rawUrl.startsWith("img:") && (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov"));

  if (isVideo) {
    const localPath = resolveMediaPath(url);
    if (fs.existsSync(localPath)) {
      const ok = await transcodeVideoClip(localPath, duration, clipPath);
      if (ok) {
        console.log(`[assembly] ${seg.sceneId}: video transcoded OK`);
        return { id: seg.id, clipPath };
      }
      console.log(`[assembly] ${seg.sceneId}: video transcode failed, using original`);
      return { id: seg.id, clipPath: localPath };
    }
    console.log(`[assembly] ${seg.sceneId}: video not local, skipping`);
    return null;
  }

  // Image segment
  let localImagePath = resolveMediaPath(url);

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const ext = url.includes(".png") ? ".png" : url.includes(".webp") ? ".webp" : ".jpg";
    const downloadPath = path.join(outputDir, `dl_${seg.id}${ext}`);
    const ok = await downloadToFile(url, downloadPath);
    if (!ok) {
      console.log(`[assembly] ${seg.sceneId}: download failed for ${url.slice(0, 80)}`);
      return null;
    }
    localImagePath = downloadPath;
    console.log(`[assembly] ${seg.sceneId}: downloaded external image`);
  }

  if (!fs.existsSync(localImagePath)) {
    // Missing image (stale/dead URL, or generation was down) → solid placeholder so the
    // scene still shows. Tagged placeholder:true so preprocessSegments can DROP it if the
    // same scene has a real image elsewhere (kills gray-flash pollution from dead URLs).
    console.warn(`[assembly] ${seg.sceneId}: image not found — using solid placeholder: ${localImagePath}`);
    if (await solidPlaceholderClip(clipPath, duration)) return { id: seg.id, clipPath, placeholder: true };
    return null;
  }

  const ok = await imageToVideoClip(localImagePath, duration, clipPath);
  if (ok) {
    console.log(`[assembly] ${seg.sceneId}: image→video OK (${duration}s)`);
    return { id: seg.id, clipPath };
  }
  // Image present but conversion produced an empty/invalid clip → solid placeholder.
  console.warn(`[assembly] ${seg.sceneId}: image→video failed — using solid placeholder clip`);
  if (await solidPlaceholderClip(clipPath, duration)) return { id: seg.id, clipPath, placeholder: true };
  return null;
}

// ── Bounded-concurrency mapper ──────────────────────────────────────────────
// CRITICAL FIX 2026-05-28: an unbounded Promise.all over the segment list spawned
// one ffmpeg per segment SIMULTANEOUSLY. A Gen-Max hybrid story expands to 50-70
// image segments; 70 concurrent ffmpeg processes saturated the 4-core VPS, so most
// conversions hit their 60s timeout and were KILLED mid-write — leaving 0-byte
// clips. Those got dropped from the concat → "images not assembled / outro didn't
// display / image display bad" (Henry's render: segs 12-69 were all 0 bytes).
// A small worker pool keeps CPU sane so every clip (incl. placeholders) finishes.
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

// ── Preprocess segments with bounded concurrency ──
// P1-B 2026-05-14: was sequential for-loop (30-60s for 8 images) → Promise.all.
// 2026-05-28: Promise.all over 70 segments killed ffmpeg under load → bounded pool.
async function preprocessSegments(
  segments: AssemblySegment[],
  outputDir: string
): Promise<Map<string, string>> {
  // Concurrent ffmpeg jobs. Server is 8-core/23GB → use 7, leaving 1 core for Next/system.
  // (Was 4 — under-utilized the box; combined with -preset ultrafast on clips this cuts
  // preprocess time for a 70-image Gen-Max story from minutes to ~10-15s. 2026-05-28 perf)
  const FFMPEG_CONCURRENCY = 7;
  const results = await mapPool(segments, FFMPEG_CONCURRENCY, seg => preprocessOneSegment(seg, outputDir));

  // Which scenes ended up with at least one REAL (non-placeholder) clip?
  // results[i] is parallel to segments[i] (mapPool preserves order).
  const scenesWithReal = new Set<string>();
  results.forEach((r, i) => {
    if (r && !r.placeholder && segments[i].sceneId) scenesWithReal.add(segments[i].sceneId!);
  });

  // DEAD-URL FIX 2026-05-28: drop a gray placeholder when its scene already has a real
  // image (stale/dead candidate URLs from old sessions were leaking gray flashes into the
  // video). Keep placeholders for single-image scenes / fully-missing scenes (timeline
  // stays aligned) and for intro/outro cards (no sceneId).
  const resolved = new Map<string, string>();
  let droppedPlaceholders = 0;
  results.forEach((r, i) => {
    if (!r) return;
    const sid = segments[i].sceneId;
    if (r.placeholder && sid && scenesWithReal.has(sid)) { droppedPlaceholders++; return; }
    resolved.set(r.id, r.clipPath);
  });
  if (droppedPlaceholders > 0) {
    console.log(`[assembly] dropped ${droppedPlaceholders} redundant gray placeholder(s) (scene had a real image)`);
  }
  return resolved;
}

// FIX (2026-05-24): Cloudflare Free Plan has a 100s edge HTTP timeout. Long
// assemblies (8+ min for 30 scenes) caused the client to receive an HTML 524
// page → "Unexpected token '<', '<!DOCTYPE'" client-side error, even though
// the server FINISHED the video correctly in the background.
//
// Fix: wrap the route in an NDJSON streaming response. The handler emits a
// `{"heartbeat":true}\n` line every 25s while processing. CF treats any bytes
// as connection activity and resets its idle timer. Final response is one more
// NDJSON line: `{"result": <full json object as before>}\n`. Client parses
// last non-heartbeat line as the result. No timeout, no false errors.
async function runAssembly(body: { assembly: AssemblyJSON; skipApprovalCheck?: boolean }, send: (obj: object) => void): Promise<{ status: number; data: object }> {
  try {
    let assembly = body.assembly;

    if (!assembly?.segments?.length) {
      return { status: 400, data: { error: "Assembly JSON has no segments" } };
    }

    // ── Gate: Rights and approval checks ──
    if (!body.skipApprovalCheck) {
      if (assembly.soundLicenses.some(l => l.license === "cc_by" && !l.attribution)) {
        return { status: 400, data: { error: "CC BY sounds require attribution text before export" } };
      }
    }

    void send; // available for future per-phase progress events

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
      return { status: 400, data: { error: "No valid media segments after preprocessing. All images/videos unavailable." } };
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

    // ── Pre-flight: correct totalDuration + narrator endTime via ffprobe ────────
    // When React narratorAudioDuration state is lost (page refresh), page.tsx sends:
    //   totalDuration = sceneBaseDuration (~50s)
    //   narrator entry endTime = narratorFallbackSec (~40s)
    // Both values are too short if the actual narrator is e.g. 3min.
    // The assembly-builder then applies atrim=duration=40 — narrator gets cut.
    // Fix: probe the actual narrator file BEFORE building the plan, then correct BOTH
    // totalDuration AND narrator endTime so atrim never truncates real audio.
    let fullAssembly: AssemblyJSON = { ...finalAssembly, sfx: patchedSfx };
    {
      const ffprobePath = env.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
      // Pick the main narrator entry (startTime=0 OR longest endTime)
      const mainNarr = patchedNarration.find(n => n.startTime === 0)
        ?? patchedNarration.reduce((best: typeof patchedNarration[0] | null, n) =>
          n.audioUrl && (!best || (n.endTime || 0) > (best.endTime || 0)) ? n : best,
          null
        );
      if (mainNarr?.audioUrl && fs.existsSync(mainNarr.audioUrl)) {
        try {
          const { stdout } = await execFileAsync(ffprobePath,
            ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", mainNarr.audioUrl],
            { timeout: 8000 }
          );
          const realDur = parseFloat(stdout.trim());
          if (realDur > 0) {
            // Fix narrator endTime if the client sent a fallback-computed value shorter than real audio.
            // This prevents assembly-builder's atrim from truncating the narrator track.
            const correctedNarration = fullAssembly.narration.map(n =>
              n.startTime === 0 && (n.endTime ?? 0) < realDur ? { ...n, endTime: realDur } : n
            );
            // totalDuration = max(actual narrator, client-declared, last segment end).
            // Including lastSegEnd ensures intro+outro cards don't get clipped.
            const lastSegEnd = fullAssembly.segments.reduce(
              (max, s) => Math.max(max, s.endTime ?? (s.startTime + (s.duration ?? 5))),
              0
            );
            const correctedTotal = Math.max(realDur, fullAssembly.totalDuration, lastSegEnd);
            const narrChanged = correctedNarration.some((n, i) => n.endTime !== fullAssembly.narration[i]?.endTime);
            if (correctedTotal !== fullAssembly.totalDuration || narrChanged) {
              console.log(`[assembly] Pre-flight corrected: totalDuration ${fullAssembly.totalDuration.toFixed(1)}s → ${correctedTotal.toFixed(1)}s, narrator endTime → ${realDur.toFixed(1)}s`);
              fullAssembly = { ...fullAssembly, totalDuration: correctedTotal, narration: correctedNarration };
            }
          }
        } catch { /* ffprobe unavailable — keep declared values */ }
      }
    }

    // ── Build FFmpeg execution plan ──
    const steps = buildAssemblyPlan(fullAssembly, outputDir);

    if (steps.length === 0) {
      return { status: 400, data: { error: "No FFmpeg steps generated from assembly" } };
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
        // totalDuration was already corrected by pre-flight ffprobe above
        const totalDur = fullAssembly.totalDuration || 60;
        const finalOut = step.outputPath;

        // PERF 2026-05-28: probe concat_raw length. If the video already covers the target
        // duration (the normal case — segment durations are computed from the narration
        // clock, so they sum to ~totalDur), COPY the video stream instead of re-encoding it.
        // The old code ALWAYS `-stream_loop`-ed + re-encoded the full video (libx264), which
        // was the dominant cost on long videos. Only loop+re-encode when the video is
        // materially shorter than the audio (short clips under a long narration).
        let concatDur = 0;
        try {
          const ffprobePath2 = env.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
          const { stdout } = await execFileAsync(ffprobePath2,
            ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", concatRaw],
            { timeout: 8000 });
          concatDur = parseFloat(stdout.trim()) || 0;
        } catch { /* probe failed — assume we must loop */ }
        const needsLoop = concatDur < totalDur - 2;            // >2s short → loop+re-encode
        const loopIn = needsLoop ? ["-stream_loop", "-1"] : [];
        const tArg = needsLoop ? ["-t", String(totalDur)] : []; // only trim when looping
        const vCodec = needsLoop
          ? ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p"]
          : ["-c:v", "copy"];                                  // copy = no re-encode (fast)

        let cmd: string[];
        if (!hasNarr && !hasMus && !hasSfx) {
          cmd = [env.ffmpegPath, ...loopIn, "-i", concatRaw, ...tArg, ...vCodec, "-an", "-movflags", "+faststart", "-y", finalOut];
        } else {
          const inputs: string[] = [...loopIn, "-i", concatRaw];
          const filters: string[] = [];
          const audioSrcs: string[] = [];
          let idx = 1;
          if (hasNarr) { inputs.push("-i", narrationWav); filters.push(`[${idx}:a]volume=1.0[narr]`);          audioSrcs.push("[narr]"); idx++; }
          if (hasMus)  { inputs.push("-i", musicWav);     filters.push(`[${idx}:a]volume=0.4[mus]`); audioSrcs.push("[mus]");  idx++; }
          if (hasSfx)  { inputs.push("-i", sfxWav);       filters.push(`[${idx}:a]volume=0.6[sfx]`);          audioSrcs.push("[sfx]");  idx++; }
          const mixFilter = filters.join(";") + ";" + audioSrcs.join("") + `amix=inputs=${audioSrcs.length}:duration=longest:normalize=0[fa]`;
          cmd = [env.ffmpegPath, ...inputs, ...tArg, "-filter_complex", mixFilter, "-map", "0:v", "-map", "[fa]", ...vCodec, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-y", finalOut];
        }
        console.log(`[assembly] final_merge — narr=${hasNarr} music=${hasMus} sfx=${hasSfx} dur=${totalDur}s concat=${concatDur.toFixed(1)}s loop=${needsLoop} vcopy=${!needsLoop}`);
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

    // ── Subtitle burn-in via drawtext (no libass required) ──────────────────
    // P2-F 2026-05-14: replaced subtitles= filter (needs libass, fails on Windows)
    // with drawtext filter chain. Works on all FFmpeg builds out of the box.
    // Failure here NEVER blocks output — original video always preserved.
    let subtitledOutputPath = "";
    const subtitleStatus = {
      requested: !!assembly.exportSettings?.includeSubtitles,
      attempted: false,
      succeeded: false,
      reason: "",
      entries: 0,
      fontUsed: "",
    };
    if (!assembly.exportSettings?.includeSubtitles) {
      subtitleStatus.reason = "includeSubtitles=false in exportSettings";
    } else if (!fullAssembly.narration.some(n => n.text && n.text.trim())) {
      subtitleStatus.reason = "narration entries have no .text field — client did not send text";
    }
    if (assembly.exportSettings?.includeSubtitles) {
      const narrationWithText = fullAssembly.narration.filter(n => n.text && n.text.trim());
      if (narrationWithText.length > 0) {
        try {
          // Build timed subtitle entries from narration text
          interface SubEntry { start: number; end: number; text: string; }
          function buildSubEntries(entries: typeof narrationWithText): SubEntry[] {
            const result: SubEntry[] = [];
            const MIN_DUR = 1.5;
            // FIX (2026-05-22): cap at 20 words per caption entry so long sentences
            // are split into multiple shorter entries instead of one wide single line.
            const MAX_CAPTION_WORDS = 20;
            // ── NARRATOR/ACTOR COORDINATION (Henry 2026-05-29) ────────────────
            // Without this, narrator subtitle entries (spanning whole video) and actor
            // subtitle entries (5-10s scene windows) emit overlapping `between(t,S,E)`
            // drawtext filters → "D appears on A even before C goes". Same shared helper
            // the audio duck uses, applied to subtitle timeline.
            const { narratorIdx, actorWindows } = computeNarratorWindows(entries);
            console.log(`[subtitle-coord] narratorIdx=${narratorIdx} actorWindows=${actorWindows.length} entries=${entries.length}`);
            const actorWindowAt = (t: number): [number, number] | null => {
              for (const w of actorWindows) if (t >= w[0] && t < w[1]) return w;
              return null;
            };
            const nextActorStartAfter = (t: number, before: number): number | null => {
              let best: number | null = null;
              for (const [s] of actorWindows) {
                if (s > t && s < before && (best === null || s < best)) best = s;
              }
              return best;
            };
            for (let entryIdx = 0; entryIdx < entries.length; entryIdx++) {
              const entry = entries[entryIdx];
              const text = entry.text!.trim();
              const entryStart = entry.startTime || 0;
              const rawEnd = entry.endTime || 0;
              // Guard against legacy 99999 fallback — cap at a sane window
              const entryEnd = rawEnd > 9000 ? entryStart + 300 : Math.max(rawEnd, entryStart + 1);
              const totalDur = entryEnd - entryStart;
              // Split on sentence-ending punctuation; fall back to full text if no punctuation
              const raw = text.match(/[^.!?]+[.!?]*/g) || [text];
              // Further split any sentence >MAX_CAPTION_WORDS into word-count chunks
              const sentences: string[] = [];
              for (const chunk of raw) {
                const s = chunk.trim();
                if (!s) continue;
                const ws = s.split(/\s+/).filter(Boolean);
                if (ws.length <= MAX_CAPTION_WORDS) {
                  sentences.push(s);
                } else {
                  for (let wi = 0; wi < ws.length; wi += MAX_CAPTION_WORDS) {
                    sentences.push(ws.slice(wi, wi + MAX_CAPTION_WORDS).join(" "));
                  }
                }
              }
              if (sentences.length === 0) continue;
              // Word-count proportion — speech speed is roughly proportional to word count
              const wordCounts = sentences.map(s => Math.max(s.split(/\s+/).filter(Boolean).length, 1));
              const totalWords = wordCounts.reduce((a, b) => a + b, 0);
              const isNarrator = entryIdx === narratorIdx;
              let cursor = entryStart;
              for (let i = 0; i < sentences.length; i++) {
                if (cursor >= entryEnd) break;
                // Narrator only: skip cursor past any actor window it falls inside
                if (isNarrator) {
                  const win = actorWindowAt(cursor);
                  if (win) {
                    cursor = win[1];
                    if (cursor >= entryEnd) break;
                  }
                }
                const dur = Math.max((wordCounts[i] / totalWords) * totalDur, MIN_DUR);
                let end = Math.min(cursor + dur, entryEnd);
                // Narrator only: clip end at next actor window start so caption doesn't bleed
                if (isNarrator) {
                  const nextActor = nextActorStartAfter(cursor, end);
                  if (nextActor !== null) end = nextActor;
                }
                // Drop sub-0.5s windows (would flash imperceptibly)
                if (end - cursor >= 0.5) {
                  result.push({ start: cursor, end, text: sentences[i] });
                }
                cursor = end;
              }
            }
            return result;
          }

          // Escape text for FFmpeg drawtext: \ → \\, ' → \', : → \:
          function escDrawtext(t: string): string {
            // FFmpeg drawtext text='...' value escaping:
            // - preserve our \n line-break sequences (set by wrapText) — protect them first
            // - escape any other backslashes
            // - escape colons (filter param separator)
            // - escape apostrophes (inside single quotes); FFmpeg accepts \' inside text=
            // Also escape brackets/comma which can break the outer filter chain.
            const NL = "NL";
            return t
              .replace(/\\n/g, NL)
              .replace(/\\/g, "\\\\")
              .replace(/:/g, "\\:")
              .replace(/'/g, "\\'")
              .replace(/%/g, "\\%")
              .replace(new RegExp(NL, "g"), "\\n");
          }

          // Wrap text at ~40 chars — conservative enough for bold/wide fonts at 1920px
          function wrapText(t: string, maxLen = 40): string {
            if (t.length <= maxLen) return t;
            const words = t.split(" ");
            const lines: string[] = [];
            let cur = "";
            for (const w of words) {
              if ((cur + " " + w).trim().length > maxLen && cur) {
                lines.push(cur.trim());
                cur = w;
              } else {
                cur = cur ? cur + " " + w : w;
              }
            }
            if (cur) lines.push(cur.trim());
            // drawtext supports \n for line breaks
            return lines.join("\\n");
          }

          const subEntries = buildSubEntries(narrationWithText);
          // FIX 2 (2026-05-23): SRT-first via libass, unlimited entries; drawtext fallback
          // remains for FFmpeg builds without libass (Windows minimal builds). On Linux
          // server (where libass IS available) this removes the 300-entry cap entirely,
          // fixing children's 40+ min stories losing subtitles mid-video.
          const capped = subEntries.slice(0, 300);

          if (capped.length > 0 || subEntries.length > 0) {
            // Resolve font file — drawtext on Windows silently fails without an explicit fontfile.
            // env.fontDir = C:\Windows\Fonts on Windows, /usr/share/fonts on Linux.
            const subCfg = assembly.exportSettings?.subtitleConfig;
            // Font family → candidate filenames (first existing file wins)
            const fontCandidates: string[] = subCfg?.fontFamily === "serif"
              ? ["georgia.ttf", "times.ttf", "timesbd.ttf", "arial.ttf"]
              : subCfg?.fontFamily === "mono"
              ? ["cour.ttf", "DejaVuSansMono.ttf", "arial.ttf"]
              : subCfg?.fontFamily === "display"
              ? ["impact.ttf", "ariblk.ttf", "arial.ttf"]
              : ["arial.ttf", "DejaVuSans.ttf"]; // sans (default)
            const dejavuPath = path.join(env.fontDir, "truetype", "dejavu", "DejaVuSans.ttf");
            const dejavuPath2 = path.join(env.fontDir, "DejaVuSans.ttf");
            let fontFilePath: string | null = null;
            for (const candidate of fontCandidates) {
              const p = path.join(env.fontDir, candidate);
              if (fs.existsSync(p)) { fontFilePath = p; break; }
            }
            if (!fontFilePath) {
              if (fs.existsSync(dejavuPath)) fontFilePath = dejavuPath;
              else if (fs.existsSync(dejavuPath2)) fontFilePath = dejavuPath2;
            }
            // fontfile value for FFmpeg filter — use forward slashes, single-quote to protect colon in C:
            // Windows fontfile must have colons escaped — FFmpeg drawtext treats `:`
            // as a filter param separator even inside single quotes.
            // `C:/Windows/Fonts/arial.ttf` → `C\\:/Windows/Fonts/arial.ttf`
            const fontFileOpt = fontFilePath
              ? `fontfile='${fontFilePath.replace(/\\/g, "/").replace(/:/g, "\\:")}'`
              : "";
            const withFont = (s: string) => fontFileOpt ? `${fontFileOpt}:${s}` : s;

            // Build drawtext filter chain: each entry is time-gated with enable='between(t,S,E)'
            // box=1 gives a background bar — readable even when shadows fail on minimal FFmpeg builds.
            const styleParams: Record<string, string> = {
              cinema:  withFont("fontsize=36:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=12:shadowcolor=black@0.9:shadowx=2:shadowy=2"),
              neon:    withFont("fontsize=32:fontcolor=cyan:box=1:boxcolor=black@0.7:boxborderw=11:shadowcolor=magenta@0.6:shadowx=1:shadowy=0"),
              bold:    withFont("fontsize=40:fontcolor=white:box=1:boxcolor=black@0.8:boxborderw=14:shadowcolor=black:shadowx=3:shadowy=3"),
              classic: withFont("fontsize=32:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=11:shadowcolor=black@0.8:shadowx=2:shadowy=2"),
              minimal: withFont("fontsize=32:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=8"),
              none:    "",
            };
            const globalStyle = assembly.exportSettings?.subtitleStyle ?? "classic";
            // If style is "none", skip subtitle burn-in entirely
            if (globalStyle !== "none") {
              // Build dynamic style from SubtitleConfig when present
              let defaultDrawStyle: string;
              if (subCfg) {
                const textHex = (subCfg.textColor || "#ffffff").replace("#", "0x");
                const bgOpacity = Math.min(1, Math.max(0, subCfg.bgOpacity ?? 0.75));
                const fontSize = Math.min(80, Math.max(18, subCfg.fontSize ?? 32));
                const borderW = Math.round(fontSize * 0.35);
                const boxPart = subCfg.bgBox !== false
                  ? `:box=1:boxcolor=black@${bgOpacity.toFixed(2)}:boxborderw=${borderW}`
                  : "";
                defaultDrawStyle = withFont(`fontsize=${fontSize}:fontcolor=${textHex}${boxPart}:shadowcolor=black@0.8:shadowx=2:shadowy=2`);
              } else {
                defaultDrawStyle = styleParams[globalStyle] || styleParams.classic;
              }

              // Y position from SubtitleConfig position setting.
              // Bottom: pin the BOTTOM of the text block to the safe area (54px = 5% of 1080).
              // h*0.88 would place the TOP there — multi-line captions then overflow below the frame.
              const subY = subCfg?.position === "top" ? "h*0.06"
                : subCfg?.position === "center" ? "(h-th)/2"
                : "h-th-54"; // bottom: bottom edge of text block = h - 54px safe margin

              // Helper: find segment active at a given midpoint time for per-segment style override
              const sortedSegments = [...(fullAssembly.segments || [])].sort(
                (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)
              );
              function getSegmentStyleAt(midTime: number): string {
                const seg = sortedSegments.find(
                  s => (s.startTime ?? 0) <= midTime && (s.endTime ?? Infinity) > midTime
                );
                const segStyle = seg?.subtitleStyle;
                if (segStyle && styleParams[segStyle]) {
                  return styleParams[segStyle];
                }
                return defaultDrawStyle;
              }

              console.log(`[subtitle] font=${fontFilePath || "NONE"} style=${globalStyle} cfg=${subCfg ? `fontSize=${subCfg.fontSize} pos=${subCfg.position}` : "legacy"} entries=${capped.length} firstWindow=[${capped[0]?.start.toFixed(1)},${capped[0]?.end.toFixed(1)}]`);

              const drawChain = capped.map(e => {
                const midTime = (e.start + e.end) / 2;
                const subStyleBase = getSegmentStyleAt(midTime);
                const baseStyle = `${subStyleBase}:x=(w-tw)/2:y=${subY}`;
                return `drawtext=${baseStyle}:text='${escDrawtext(wrapText(e.text))}':enable='between(t,${e.start.toFixed(3)},${e.end.toFixed(3)})'`;
              }).join(",");

              subtitleStatus.attempted = true;
              subtitleStatus.entries = subEntries.length;
              subtitleStatus.fontUsed = fontFilePath || "none";
              const finalMergeStep = steps.find(s => s.id === "final_merge");
              const unsub = finalMergeStep?.outputPath || "";
              if (unsub && fs.existsSync(unsub)) {
                const subbedPath = unsub.replace(".mp4", "_subtitled.mp4");

                // FIX 2 (2026-05-23): libass path FIRST — unlimited entries.
                // Helper: #rrggbb → libass &Hbbggrr (BGR, no alpha)
                const hexToBgr = (hex: string) => {
                  const h = (hex || "#ffffff").replace("#", "");
                  if (h.length !== 6) return "FFFFFF";
                  return (h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase();
                };
                // SRT content from FULL subEntries (no cap)
                // ── SUBTITLE SIZE FIX 2026-05-27 ──────────────────────────────────
                // Was: SRT + force_style. ffmpeg's SRT→ASS conversion defaults the script
                // canvas to PlayResY=288, so libass scaled FontSize up ~3.75x onto the 1080
                // frame (FontSize=32 rendered ~120px → "subtitles too big" on real renders).
                // Fix: emit a real .ass with explicit PlayResX/Y=1920x1080 so FontSize = REAL
                // pixels at output resolution. All clips are normalized to 1920x1080 upstream.
                //
                // ── 8 PER-WORD STYLE PRESETS (Henry 2026-05-29) ───────────────────
                // FB/YT-inspired modes wired through to ASS. Each preset overrides ASS
                // style fields AND optionally emits per-word override tags (\fscx, \1c,
                // \kf, \alpha\t, \fad) inside Dialogue Text. mrbeast_single explodes ONE
                // Dialogue per word for the single-large-word effect.
                interface SubtitlePreset {
                  fontName?: string; fontSize?: number;
                  primaryHex?: string; secondaryHex?: string; outlineHex?: string;
                  outlineWidth?: number; shadowDepth?: number;
                  borderStyle?: 1 | 3; bold?: 0 | 1; bgOpacity?: number;
                  perWord?: "dance" | "rainbow" | "bubble" | "yellow_sweep" | "glow_line" | "single_word" | "typewriter_line" | "none";
                }
                const SUBTITLE_PRESETS: Record<string, SubtitlePreset> = {
                  dance_word:     { fontName: "Arial Black", fontSize: 56, primaryHex: "#ffffff", outlineHex: "#fbbf24", outlineWidth: 4, borderStyle: 1, bold: 1, bgOpacity: 0, perWord: "dance" },
                  rainbow:        { fontName: "Arial Black", fontSize: 52, primaryHex: "#ffffff", outlineHex: "#000000", outlineWidth: 3, borderStyle: 1, bold: 1, bgOpacity: 0, perWord: "rainbow" },
                  bubble_pop:     { fontName: "Arial Black", fontSize: 50, primaryHex: "#ffffff", outlineHex: "#7c3aed", outlineWidth: 4, borderStyle: 1, bold: 1, bgOpacity: 0, perWord: "bubble" },
                  big_friendly:   { fontName: "Arial Black", fontSize: 58, primaryHex: "#ffffff", outlineHex: "#fbbf24", outlineWidth: 8, borderStyle: 1, bold: 1, bgOpacity: 0, perWord: "none" },
                  mrbeast_single: { fontName: "Impact",      fontSize: 96, primaryHex: "#ffffff", outlineHex: "#000000", outlineWidth: 8, shadowDepth: 4, borderStyle: 1, bold: 1, bgOpacity: 0, perWord: "single_word" },
                  yellow_sweep:   { fontName: "Arial",       fontSize: 48, primaryHex: "#fde047", secondaryHex: "#ffffff", outlineHex: "#000000", outlineWidth: 3, borderStyle: 3, bold: 1, perWord: "yellow_sweep" },
                  glow_pop:       { fontName: "Impact",      fontSize: 54, primaryHex: "#ffffff", outlineHex: "#22d3ee", outlineWidth: 4, shadowDepth: 6, borderStyle: 1, bold: 1, bgOpacity: 0, perWord: "glow_line" },
                  typewriter:     { fontName: "Courier New", fontSize: 44, primaryHex: "#fef3c7", outlineHex: "#451a03", outlineWidth: 2, borderStyle: 1, bold: 0, bgOpacity: 0, perWord: "typewriter_line" },
                };
                const preset: SubtitlePreset = (subCfg?.mode && SUBTITLE_PRESETS[subCfg.mode]) || {};

                const fontSize = Math.min(96, Math.max(18, preset.fontSize ?? subCfg?.fontSize ?? 32));
                const primaryHex = preset.primaryHex ?? subCfg?.textColor ?? "#ffffff";
                const primaryBgr = hexToBgr(primaryHex);
                const secondaryBgr = preset.secondaryHex
                  ? hexToBgr(preset.secondaryHex)
                  : (subCfg?.highlightColor ? hexToBgr(subCfg.highlightColor) : "0000FF");
                const outlineBgr = preset.outlineHex ? hexToBgr(preset.outlineHex) : "000000";
                const outlineWidth = preset.outlineWidth ?? 2;
                const shadowDepth = preset.shadowDepth ?? 2;
                const bold = preset.bold ?? 0;
                const bgOp = Math.min(1, Math.max(0, preset.bgOpacity ?? subCfg?.bgOpacity ?? 0.75));
                // ASS alpha: 00 = opaque, FF = transparent. Convert UI opacity (0..1) → alpha hex
                const bgAlpha = Math.round((1 - bgOp) * 255).toString(16).padStart(2, "0").toUpperCase();
                const marginV = subCfg?.position === "top" ? Math.round(1080 * 0.06)
                  : subCfg?.position === "center" ? Math.round(1080 * 0.45)
                  : 54;
                const alignment = subCfg?.position === "top" ? 8 : subCfg?.position === "center" ? 5 : 2;
                const fontName = preset.fontName ?? (subCfg?.fontFamily === "serif" ? "Georgia"
                  : subCfg?.fontFamily === "mono" ? "Courier New"
                  : subCfg?.fontFamily === "display" ? "Impact"
                  : "Arial");
                const borderStyle = preset.borderStyle ?? (subCfg?.bgBox === false ? 1 : 3);
                // ASS timestamp: H:MM:SS.cc
                const assTime = (sec: number): string => {
                  const hh = Math.floor(sec / 3600);
                  const mm = Math.floor((sec % 3600) / 60);
                  const whole = Math.floor(sec % 60);
                  const cs = Math.floor(((sec % 60) - whole) * 100);
                  return `${hh}:${String(mm).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
                };
                const assStyleLine = `Style: Default,${fontName},${fontSize},&H00${primaryBgr},&H00${secondaryBgr},&H00${outlineBgr},&H${bgAlpha}000000,${bold},0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${shadowDepth},${alignment},40,40,${marginV},1`;

                // Per-mode Dialogue formatter — returns array because mrbeast_single explodes into N lines.
                // Rainbow color palette (BGR for libass)
                const RAINBOW_BGR = ["0000FF", "0080FF", "00FFFF", "00FF00", "FF8000", "FF00FF", "FFFF00"];
                function formatDialogueLines(e: { start: number; end: number; text: string }): string[] {
                  const text = (e.text || "").trim();
                  if (!text) return [];
                  const startTs = assTime(e.start);
                  const endTs = assTime(e.end);
                  const durSec = Math.max(0.3, e.end - e.start);
                  const durMs = durSec * 1000;
                  const words = text.split(/\s+/).filter(Boolean);
                  if (words.length === 0) return [];

                  switch (preset.perWord) {
                    case "single_word": {
                      // ONE word per Dialogue, evenly distributed across the entry window
                      const wordDur = durSec / words.length;
                      return words.map((w, i) => {
                        const ws = e.start + i * wordDur;
                        const we = ws + wordDur;
                        return `Dialogue: 0,${assTime(ws)},${assTime(we)},Default,,0,0,0,,{\\fad(60,60)}${w}`;
                      });
                    }
                    case "rainbow": {
                      const inner = words.map((w, i) => `{\\1c&H00${RAINBOW_BGR[i % RAINBOW_BGR.length]}&}${w}`).join(" ");
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,{\\fad(120,120)}${inner}`];
                    }
                    case "dance": {
                      // each word: starts 80%, scales to 135%, settles 100%
                      const inner = words.map(w => `{\\fscx80\\fscy80\\t(0,120,\\fscx135\\fscy135)\\t(120,260,\\fscx100\\fscy100)}${w}`).join(" ");
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,{\\fad(80,80)}${inner}`];
                    }
                    case "bubble": {
                      // pop-in: starts tiny, expands and settles
                      const inner = words.map(w => `{\\fscx20\\fscy20\\t(0,160,\\fscx115\\fscy115)\\t(160,280,\\fscx100\\fscy100)}${w}`).join(" ");
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,{\\fad(120,200)}${inner}`];
                    }
                    case "yellow_sweep": {
                      // ASS \kf: karaoke fill that sweeps the secondary→primary color across word
                      const perWordCs = Math.max(10, Math.floor((durMs / words.length) / 10));
                      const inner = words.map(w => `{\\kf${perWordCs}}${w}`).join(" ");
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,{\\fad(100,100)}${inner}`];
                    }
                    case "glow_line": {
                      // whole-line glow with fad (outline color in style already gives the neon look)
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,{\\fad(180,180)}${text.replace(/\r?\n/g, "\\N")}`];
                    }
                    case "typewriter_line": {
                      // per-word stagger fade-in (poor man's typewriter — full chars too expensive in tags)
                      const stagger = Math.min(80, Math.floor(durMs / Math.max(words.length * 4, 1)));
                      const inner = words.map((w, i) => `{\\alpha&HFF&\\t(${i * stagger},${i * stagger + 60},\\alpha&H00&)}${w}`).join(" ");
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,${inner}`];
                    }
                    case "none":
                    default:
                      return [`Dialogue: 0,${startTs},${endTs},Default,,0,0,0,,{\\fad(100,100)}${text.replace(/\r?\n/g, "\\N")}`];
                  }
                }

                // NOTE: keep var names srtPath/srtContent/srtFilter — downstream write + filter
                // reference them. Content is now ASS; path uses .ass extension.
                const srtContent = [
                  "[Script Info]",
                  "ScriptType: v4.00+",
                  "PlayResX: 1920",
                  "PlayResY: 1080",
                  "WrapStyle: 0",
                  "ScaledBorderAndShadow: yes",
                  "",
                  "[V4+ Styles]",
                  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
                  assStyleLine,
                  "",
                  "[Events]",
                  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
                  ...subEntries.flatMap(formatDialogueLines),
                  "",
                ].join("\n");
                console.log(`[subtitle-preset] mode=${subCfg?.mode ?? "none"} preset=${Object.keys(preset).length > 0 ? "applied" : "default"} font=${fontName} size=${fontSize} perWord=${preset.perWord ?? "n/a"}`);
                const srtPath = unsub.replace(".mp4", ".ass");
                // FFmpeg subtitles= filter: escape backslashes + colons in path. Style is baked
                // into the .ass header so no force_style override is needed.
                const srtEsc = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
                const srtFilter = `subtitles='${srtEsc}'`;

                let srtOk = false;
                try {
                  fs.writeFileSync(srtPath, srtContent, "utf-8");
                  await execFileAsync(env.ffmpegPath, [
                    "-i", unsub,
                    "-vf", srtFilter,
                    "-c:a", "copy",
                    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                    "-y", subbedPath,
                  ], { timeout: 600000 });
                  if (fs.existsSync(subbedPath) && fs.statSync(subbedPath).size > 0) {
                    subtitledOutputPath = subbedPath;
                    subtitleStatus.succeeded = true;
                    subtitleStatus.entries = subEntries.length;
                    srtOk = true;
                    console.log(`[assembly] Subtitle SRT/libass burn-in OK (${subEntries.length} entries, style=${globalStyle}, unlimited) → ${path.basename(subbedPath)}`);
                  }
                } catch (srtErr) {
                  const msg = srtErr instanceof Error ? srtErr.message : String(srtErr);
                  if (/no such filter|libass|unknown.+subtitles/i.test(msg)) {
                    console.warn("[subtitle] libass unavailable — falling back to drawtext (cap 300):", msg.slice(0, 200));
                  } else {
                    console.warn("[subtitle] SRT path errored — falling back to drawtext:", msg.slice(0, 200));
                  }
                }

                // Drawtext FALLBACK — runs only if SRT path failed/produced no file
                if (!srtOk) {
                  try {
                    await execFileAsync(env.ffmpegPath, [
                      "-i", unsub,
                      "-vf", drawChain,
                      "-c:a", "copy",
                      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                      "-movflags", "+faststart",
                      "-y", subbedPath,
                    ], { timeout: 300000 });
                    if (fs.existsSync(subbedPath) && fs.statSync(subbedPath).size > 0) {
                      subtitledOutputPath = subbedPath;
                      subtitleStatus.succeeded = true;
                      subtitleStatus.entries = capped.length;
                      console.log(`[assembly] Subtitle drawtext burn-in OK (${capped.length}/${subEntries.length} entries, style=${globalStyle}, drawtext fallback) → ${path.basename(subbedPath)}`);
                    } else {
                      subtitleStatus.reason = "subtitled file produced but empty or missing";
                    }
                  } catch (dtErr) {
                    subtitleStatus.reason = `drawtext failed: ${dtErr instanceof Error ? dtErr.message.slice(0, 1200) : String(dtErr)}`;
                    console.error("[subtitle] drawtext FAILED:", dtErr instanceof Error ? dtErr.message.slice(0, 400) : dtErr);
                    console.error("[subtitle] chain sample:", drawChain.slice(0, 300));
                  }
                }
              } else {
                subtitleStatus.reason = `final_merge output not found at ${unsub}`;
                console.warn("[subtitle] final_merge output not found — skipping burn-in. unsub=", unsub);
              }
            } else {
              subtitleStatus.reason = `globalStyle is 'none' (subtitleStyle=${globalStyle})`;
            } // globalStyle !== "none"
          } else {
            subtitleStatus.reason = "no subtitle entries built from narration text";
          }
        } catch (subErr) {
          subtitleStatus.reason = `subtitle build error: ${subErr instanceof Error ? subErr.message.slice(0, 300) : String(subErr)}`;
          console.error("[assembly] Subtitle burn-in error:", subErr instanceof Error ? subErr.message.slice(0, 400) : subErr);
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
            status: "IN_REVIEW",
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

    return {
      status: 200,
      data: {
        success: outputExists,
        outputUrl: assetUrl,
        outputPath: finalOutputPath,
        thumbnailUrl,
        duration: finalDuration,
        steps: results,
        cost,
        subtitleStatus,
        assembly: {
          projectId: assembly.projectId,
          version: assembly.version,
          tier: assembly.plannerTier,
          segments: patchedSegments.length,
          narration: finalAssembly.narration.length,
          music: finalAssembly.music.length,
          sfx: fullAssembly.sfx.length,
        },
      },
    };
  } catch (err) {
    console.error("Assembly execute error:", err);
    return {
      status: 500,
      data: { error: err instanceof Error ? err.message : "Assembly execution failed" },
    };
  }
}

// ── POST entry point — wraps runAssembly in an NDJSON streaming response so ──
// ── CF Free-plan 100s edge timeout never fires on long assemblies. ──
export async function POST(req: NextRequest) {
  let body: { assembly: AssemblyJSON; skipApprovalCheck?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let done = false;
      const write = (obj: object) => {
        try { controller.enqueue(enc.encode(JSON.stringify(obj) + "\n")); } catch { /* stream may be closed */ }
      };
      // Heartbeat every 25s — CF Free-plan idle timeout is 100s
      const heartbeat = setInterval(() => {
        if (!done) write({ heartbeat: true, ts: Date.now() });
      }, 25000);
      // Initial frame so client sees activity immediately
      write({ heartbeat: true, ts: Date.now(), phase: "started" });
      try {
        const result = await runAssembly(body, write);
        write({ result: result.data, status: result.status });
      } catch (err) {
        write({ result: { error: err instanceof Error ? err.message : String(err) }, status: 500 });
      } finally {
        done = true;
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}
