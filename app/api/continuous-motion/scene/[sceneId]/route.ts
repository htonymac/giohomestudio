// GET /api/continuous-motion/scene/[sceneId]
// Returns { scene, segments, anchors } joined from DB.
// Used by the Scene Board progress polling UI.
//
// Response shape:
//   {
//     scene:    ContinuousScene | null,
//     segments: MotionSegment[],
//     anchors:  MotionAnchor[],
//   }
//
// Returns 404 if scene not found.
// Returns 503 if DB is unavailable (graceful degradation).

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  const { sceneId } = await params;

  if (!sceneId || typeof sceneId !== "string") {
    return NextResponse.json({ error: "sceneId is required." }, { status: 400 });
  }

  // ── Attempt DB query ──────────────────────────────────────────────────────
  try {
    const { prisma } = await import("@/lib/prisma");

    const scene = await prisma.continuousScene.findUnique({
      where: { id: sceneId },
    });

    if (!scene) {
      return NextResponse.json({ error: `Scene "${sceneId}" not found.` }, { status: 404 });
    }

    const [segments, anchors] = await Promise.all([
      prisma.motionSegment.findMany({
        where: { sceneId },
        orderBy: { segmentNumber: "asc" },
      }),
      prisma.motionAnchor.findMany({
        where: { sceneId },
        orderBy: { segmentNumber: "asc" },
      }),
    ]);

    return NextResponse.json({ scene, segments, anchors });

  } catch (err) {
    console.error("[continuous-motion/scene] DB error:", err);
    return NextResponse.json(
      { error: "Database unavailable. Try again shortly.", scene: null, segments: [], anchors: [] },
      { status: 503 }
    );
  }
}
