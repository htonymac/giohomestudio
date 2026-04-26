// POST /api/continuous-motion/plan
// Full continuous motion pipeline:
//   1. Plan motion units (Claude splits prompt by physical action)
//   2. Plan segment durations (maps units to generation blocks)
//   3. Generate segment 1 from text (adapter.generateFromText)
//   4. Extract motion anchor (last frame of clip via FFmpeg)
//   5. Generate each subsequent segment from anchor (adapter.generateFromImage)
//   6. Assemble all clips into one final.mp4 (FFmpeg concat)
//   7. Persist progress to continuous_scenes, motion_segments, motion_anchors tables
//
// Request:
//   {
//     prompt: string            // Full scene prompt
//     totalDuration: number     // Total scene duration in seconds
//     segmentDuration: number   // Max segment duration (provider limit)
//     providerKey: string       // "wan" | "kling_std"
//     seed?: number             // Optional seed for consistency
//     projectId?: string
//     userId?: string
//   }
//
// Response:
//   { plan: MotionPlan, sceneId: string, status: string, finalVideoUrl?: string }

import { NextRequest, NextResponse } from "next/server";
import { planScene } from "../../../../src/lib/continuous-motion/motion-planner";
import { runContinuityChain } from "../../../../src/lib/continuous-motion/continuity-engine";
import { getAdapter } from "../../../../src/lib/continuous-motion/provider-router";
import path from "path";
import os from "os";

function errorResponse(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.");
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const totalDuration = typeof body.totalDuration === "number" ? Math.max(1, body.totalDuration) : 10;
  const segmentDuration = typeof body.segmentDuration === "number" ? Math.max(1, body.segmentDuration) : 5;
  const providerKey = typeof body.providerKey === "string" ? body.providerKey : "wan";
  const seed = typeof body.seed === "number" ? body.seed : undefined;
  const projectId = typeof body.projectId === "string" ? body.projectId : "default";
  const userId = typeof body.userId === "string" ? body.userId : "default";

  if (!prompt) {
    return errorResponse("prompt is required.");
  }

  // ── 1. Validate provider ──────────────────────────────────────────────────
  let adapter;
  try {
    adapter = getAdapter(providerKey);
  } catch (err) {
    return errorResponse(String(err), 400);
  }

  // ── 2. Plan motion units and segment durations ────────────────────────────
  const plan = await planScene(prompt, totalDuration, segmentDuration);

  // ── 3. Persist scene record to DB ─────────────────────────────────────────
  let sceneId = `scene_${Date.now()}`;
  let dbAvailable = false;
  let prisma: import("@prisma/client").PrismaClient | null = null;

  try {
    ({ prisma } = await import("@/lib/prisma"));
    const scene = await prisma.continuousScene.create({
      data: {
        projectId,
        userId,
        fullPrompt: prompt,
        totalDurationSeconds: totalDuration,
        segmentDurationSeconds: segmentDuration,
        providerKey,
        seed: seed ?? null,
        continuousMotion: true,
        status: "PLANNING",
      },
    });
    sceneId = scene.id;
    dbAvailable = true;
    console.log(`[continuous-motion/plan] Scene created: ${sceneId}`);
  } catch (err) {
    console.warn("[continuous-motion/plan] DB write failed (continuing):", err);
  }

  // ── 4. Update status to GENERATING ───────────────────────────────────────
  if (dbAvailable && prisma) {
    try {
      await prisma.continuousScene.update({
        where: { id: sceneId },
        data: { status: "GENERATING" },
      });
    } catch { /* non-fatal */ }
  }

  // ── 5. Run the full continuity chain ─────────────────────────────────────
  const outputDir = path.join(os.tmpdir(), "ghs-cm", sceneId);
  const chainResult = await runContinuityChain({
    segments: plan.segments.map(s => ({ motionAction: s.action, duration: s.duration })),
    basePrompt: prompt,
    providerAdapter: adapter,
    seed,
    sceneId,
    outputDir,
  });

  // ── 6. Persist segments and anchors ──────────────────────────────────────
  if (dbAvailable && prisma && chainResult.completedSegments > 0) {
    try {
      for (let i = 0; i < chainResult.completedSegments; i++) {
        const seg = plan.segments[i];
        if (!seg) continue;
        await prisma.motionSegment.create({
          data: {
            sceneId,
            segmentNumber: i + 1,
            motionAction: seg.action,
            continuationPrompt: prompt,
            durationSeconds: seg.duration,
            startTimeSeconds: Math.round(seg.startTime),
            endTimeSeconds: Math.round(seg.endTime),
            anchorImageUrl: chainResult.anchorPaths[i] ?? null,
            clipUrl: chainResult.clipPaths[i] ?? null,
            status: "COMPLETE",
          },
        });

        if (chainResult.anchorPaths[i]) {
          await prisma.motionAnchor.create({
            data: {
              sceneId,
              segmentNumber: i + 1,
              anchorImagePath: chainResult.anchorPaths[i],
            },
          });
        }
      }
    } catch (err) {
      console.warn("[continuous-motion/plan] Segment persistence failed:", err);
    }
  }

  // ── 7. Update final status ────────────────────────────────────────────────
  const finalStatus = chainResult.failedAt
    ? "FAILED"
    : chainResult.finalVideoPath
      ? "COMPLETE"
      : chainResult.error?.includes("FAL_KEY") || chainResult.error?.includes("skipped")
        ? "PLANNING" // plan-only mode (no FAL_KEY)
        : "ASSEMBLING";

  if (dbAvailable && prisma) {
    try {
      await prisma.continuousScene.update({
        where: { id: sceneId },
        data: {
          status: finalStatus,
          finalVideoUrl: chainResult.finalVideoPath ?? null,
        },
      });
    } catch { /* non-fatal */ }
  }

  // ── 8. Return response ────────────────────────────────────────────────────
  return NextResponse.json({
    plan,
    sceneId,
    status: finalStatus,
    finalVideoUrl: chainResult.finalVideoPath ?? null,
    completedSegments: chainResult.completedSegments,
    totalSegments: plan.segmentCount,
    error: chainResult.error ?? null,
  });
}
