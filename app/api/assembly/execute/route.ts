// POST /api/assembly/execute — Assembly JSON → FFmpeg Render
//
// Takes a complete Assembly JSON and executes the deterministic FFmpeg pipeline.
// Uses buildAssemblyPlan() to generate FFmpeg steps, then runs them in order.
//
// Architecture (from Support Canvas):
// "FFmpeg command builder converts the JSON into deterministic commands"
// "Same JSON always produces same FFmpeg commands — only planning quality changes"
//
// Flow:
// 1. Validate Assembly JSON (rights confirmed, preview approved)
// 2. Write concat list and prepare temp files
// 3. Execute FFmpeg steps in dependency order
// 4. Save final output to asset library
// 5. Update Assembly Record in DB

import { NextRequest, NextResponse } from "next/server";
import { buildAssemblyPlan, estimateAssemblyCost } from "@/lib/assembly-builder";
import type { AssemblyJSON } from "@/lib/assembly-schema";
import { audit } from "@/lib/audit";
import { env } from "@/config/env";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body: { assembly: AssemblyJSON; skipApprovalCheck?: boolean } = await req.json();
    const { assembly } = body;

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

    // ── Prepare output directory ──
    const outputDir = path.join(env.storagePath, "video", "assembly", `${assembly.projectId}_${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    // ── Write concat list for segments ──
    if (assembly.segments.length > 0) {
      const concatContent = assembly.segments
        .sort((a, b) => a.startTime - b.startTime)
        .filter(s => s.sourceUrl && fs.existsSync(resolveMediaPath(s.sourceUrl)))
        .map(s => `file '${resolveMediaPath(s.sourceUrl).replace(/\\/g, "/")}'`)
        .join("\n");

      if (concatContent) {
        fs.writeFileSync(path.join(outputDir, "concat_list.txt"), concatContent);
      }
    }

    // ── Build FFmpeg execution plan ──
    const steps = buildAssemblyPlan(assembly, outputDir);

    if (steps.length === 0) {
      return NextResponse.json({ error: "No FFmpeg steps generated from assembly" }, { status: 400 });
    }

    // ── Execute steps in dependency order ──
    const results: Array<{ id: string; status: string; duration?: number; error?: string }> = [];
    const completedSteps = new Set<string>();

    for (const step of steps) {
      // Check dependencies
      if (step.dependsOn?.length) {
        const missingDeps = step.dependsOn.filter(d => !completedSteps.has(d));
        if (missingDeps.length > 0) {
          results.push({ id: step.id, status: "skipped", error: `Missing deps: ${missingDeps.join(", ")}` });
          continue;
        }
      }

      // Check if input files exist (skip steps with missing inputs)
      const inputArgs = step.command.filter((_, i, arr) => arr[i - 1] === "-i");
      const missingInputs = inputArgs.filter(p => !fs.existsSync(p));
      if (missingInputs.length > 0 && step.id !== "concat_segments") {
        results.push({ id: step.id, status: "skipped", error: `Missing inputs: ${missingInputs.length}` });
        continue;
      }

      try {
        const startMs = Date.now();
        const [cmd, ...args] = step.command;
        await execFileAsync(cmd, args, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

        if (fs.existsSync(step.outputPath)) {
          completedSteps.add(step.id);
          results.push({ id: step.id, status: "completed", duration: parseFloat(elapsed) });
        } else {
          results.push({ id: step.id, status: "failed", error: "Output file not created" });
        }
      } catch (err) {
        results.push({
          id: step.id,
          status: "failed",
          error: err instanceof Error ? err.message.slice(0, 200) : "FFmpeg error",
        });
      }
    }

    // ── Find final output ──
    const finalStep = steps.find(s => s.id === "final_merge");
    const finalOutputPath = finalStep?.outputPath || "";
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

      // Update Assembly Record
      try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.assemblyRecord.updateMany({
          where: { projectId: assembly.projectId },
          data: {
            renderStatus: outputExists ? "completed" : "failed",
          },
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
    const intermediateFiles = ["concat_raw.mp4", "narration_mix.mp3", "music_mix.mp3", "concat_list.txt"];
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
        segments: assembly.segments.length,
        narration: assembly.narration.length,
        music: assembly.music.length,
        sfx: assembly.sfx.length,
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

// ── Helper: Resolve /api/media/ URLs to local file paths ──
function resolveMediaPath(url: string): string {
  if (!url) return "";
  // If it's already an absolute path, use it
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  // If it's an /api/media/ URL, resolve to storage path
  if (url.startsWith("/api/media/")) {
    return path.join(env.storagePath, url.replace("/api/media/", ""));
  }
  // If it's a /storage/ path
  if (url.startsWith("/storage/")) {
    return path.join(env.storagePath, url.replace("/storage/", ""));
  }
  return url;
}
