// POST /api/continuous-motion/scene/[sceneId]/cancel
// Marks scene status = "FAILED" and marks all PENDING / GENERATING segments as "FAILED".
// Does NOT kill already-running FAL jobs (FAL has no job cancellation API).
// The orchestrator checks scene status before starting each segment,
// so cancellation effectively stops the chain after the current segment finishes.
//
// Response:
//   { ok: true, sceneId, cancelledSegments: number }
//
// Returns 404 if scene not found.
// Returns 400 if scene is already terminal (COMPLETE / FAILED).

import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  const { sceneId } = await params;

  if (!sceneId || typeof sceneId !== "string") {
    return NextResponse.json({ error: "sceneId is required." }, { status: 400 });
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    // ── Check scene exists ───────────────────────────────────────────────────
    const scene = await prisma.continuousScene.findUnique({
      where: { id: sceneId },
    });

    if (!scene) {
      return NextResponse.json({ error: `Scene "${sceneId}" not found.` }, { status: 404 });
    }

    // Already terminal — nothing to do
    if (scene.status === "COMPLETE" || scene.status === "FAILED") {
      return NextResponse.json(
        { ok: false, error: `Scene is already in terminal state: ${scene.status}` },
        { status: 400 }
      );
    }

    // ── Mark scene FAILED ────────────────────────────────────────────────────
    await prisma.continuousScene.update({
      where: { id: sceneId },
      data: { status: "FAILED" },
    });

    // ── Cancel all pending/generating segments ───────────────────────────────
    const cancelResult = await prisma.motionSegment.updateMany({
      where: {
        sceneId,
        status: { in: ["PENDING", "GENERATING"] },
      },
      data: { status: "FAILED" },
    });

    console.log(
      `[continuous-motion/cancel] Scene ${sceneId} cancelled. ` +
      `${cancelResult.count} segment(s) marked FAILED.`
    );

    return NextResponse.json({
      ok: true,
      sceneId,
      cancelledSegments: cancelResult.count,
    });

  } catch (err) {
    console.error("[continuous-motion/cancel] DB error:", err);
    return NextResponse.json(
      { error: "Database error during cancellation." },
      { status: 503 }
    );
  }
}
