// POST /api/music-video/from-karaoke
// Mints a music-video project pre-loaded with audio from a karaoke recording.
// Body:   { recordingId: string }
// Returns { ok: true, projectId: string, redirectUrl: string } | { error: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.recordingId !== "string") {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }
    const { recordingId } = body as { recordingId: string };

    // 1. Load the karaoke recording
    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    // 2. Resolve audio source: prefer mixedOutputUrl, fall back to raw fileUrl
    const audioUrl = recording.mixedOutputUrl ?? recording.fileUrl ?? null;
    if (!audioUrl) {
      return NextResponse.json({ error: "no usable audio" }, { status: 400 });
    }

    // 3. Mint a stable project ID
    const projectId = `mv_kara_${recordingId}_${Date.now().toString(36)}`;

    // 4. Persist project state via the proven /api/hybrid/saved-state HTTP route.
    //    The underlying table (hybrid_saved_states) uses raw SQL inserts in that
    //    route — we call it here to stay consistent rather than duplicating the
    //    upsert logic with a different accessor.
    const statePayload = {
      source: "karaoke",
      karaokeRecordingId: recordingId,
      audioUrl,
      transcript: recording.transcript ?? "",
      flowProfile: recording.flowProfile ?? null,
      analysis: recording.analysis ?? null,
      createdFrom: "karaoke-handoff",
      timestamp: Date.now(),
    };

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3200";

    const saveRes = await fetch(`${baseUrl}/api/hybrid/saved-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: projectId, data: statePayload }),
    });

    if (!saveRes.ok) {
      const errText = await saveRes.text().catch(() => "unknown");
      console.error("[from-karaoke] saved-state write failed:", errText);
      return NextResponse.json({ error: "Failed to persist project state" }, { status: 500 });
    }

    // 5. Return redirect info
    const redirectUrl = `/dashboard/music-video-planner?projectId=${projectId}`;
    return NextResponse.json({ ok: true, projectId, redirectUrl });
  } catch (err) {
    console.error("[from-karaoke] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
