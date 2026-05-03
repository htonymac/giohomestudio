// POST /api/karaoke/generate-music
// Body: { recordingId: string, brief?: Partial<ProductionBrief>, mode?: string }
//
// FLOW LOCK (canvas §2): disabled until Steps 3 + 5 + 7 + 9 all complete.
// Returns 400 with lockReason if any prerequisite is missing.
//
// Mode routing:
//   A/C/D (vocals) → tries Kie.ai → falls back to Stock
//   E (beat match / instrumental) → tries Stable Audio (≤47s) or Mubert (>47s) → Stock
//   B (karaoke from existing song) → no music gen; returns stub with karaoke path
//
// Saves generatedMusicUrl on KaraokeRecording.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMusicProvider, pickAutomaticProvider } from "@/modules/music-provider";
import type { MusicProviderKey } from "@/modules/music-provider";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId, brief: briefOverride, mode: modeOverride, providerKey: providerKeyOverride } = body;

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    const karaokeMode = modeOverride || recording.mode || "A";
    const analysis = recording.analysis as Record<string, unknown> | null;
    const flowProfile = recording.flowProfile as Record<string, unknown> | null;
    const productionBrief = (briefOverride || recording.productionBrief) as Record<string, unknown> | null;

    // ── FLOW LOCK (canvas §2) ────────────────────────────────────────────────
    const lockReasons: string[] = [];

    if (!analysis) {
      lockReasons.push("Audio Analysis (Step 3) not complete");
    }
    if (!recording.transcript) {
      lockReasons.push("Lyrics Extraction (Step 5) not complete");
    }
    if (!flowProfile) {
      lockReasons.push("Flow Profiling (Step 7) not complete");
    }
    if (!productionBrief) {
      lockReasons.push("Production Brief (Step 9) not complete");
    }

    if (lockReasons.length > 0) {
      return NextResponse.json(
        {
          locked: true,
          lockReasons,
          message: "Complete analysis, lyrics, flow, brief first. (canvas §2 flow lock)",
        },
        { status: 400 }
      );
    }

    // ── Mode B — no music gen ─────────────────────────────────────────────────
    if (karaokeMode === "B") {
      return NextResponse.json({
        recordingId,
        mode: "B",
        message: "Mode B (Voice → Karaoke): no music generation. Use the existing recording for karaoke export.",
        generatedMusicUrl: null,
        provider: "none",
        isKaraokeMode: true,
      });
    }

    // ── Mode E — instrumental beat match ─────────────────────────────────────
    const isInstrumental = karaokeMode === "E";
    const brief = productionBrief!;
    const tempo = typeof brief.tempo === "number" ? brief.tempo : 90;
    const genre = typeof brief.genre === "string" ? brief.genre : "Afrobeats";
    const mood = typeof brief.mood === "string" ? brief.mood : "energetic";
    const instructions = typeof brief.instructions === "string" ? brief.instructions : "";
    const durationSec = typeof brief.duration === "number" ? brief.duration : 60;

    const promptText = `${instructions} Genre: ${genre}. BPM: ${tempo}. Mood: ${mood}. Beat family: ${brief.selectedBeatFamily || "Afro Light Groove"}. Key: ${brief.key || "C major"}. Structure: ${brief.structure || "Verse → Chorus → Outro"}.`;

    let providerKey: MusicProviderKey;
    let hasLyrics = false;

    if (providerKeyOverride && ["stock", "stable_audio", "kie", "mubert"].includes(providerKeyOverride)) {
      // Explicit tier override from UI
      providerKey = providerKeyOverride as MusicProviderKey;
      hasLyrics = providerKey === "kie";
    } else if (isInstrumental) {
      // Mode E — instrumental only
      hasLyrics = false;
      if (durationSec <= 47) {
        providerKey = process.env.FAL_KEY ? "stable_audio" : "stock";
      } else {
        providerKey = process.env.MUBERT_PAT ? "mubert" : "stock";
      }
    } else {
      // Mode A / C / D — lyrical
      hasLyrics = true;
      providerKey = process.env.KIE_AI_API_KEY ? "kie" : "stock";
    }

    const input = {
      prompt: promptText.slice(0, 500),
      durationSeconds: Math.min(Math.max(durationSec, 10), 300),
      genre,
      mood,
      hasLyrics,
    };

    let musicResult;
    try {
      const provider = getMusicProvider(providerKey);
      musicResult = await provider.generate(input);
    } catch (providerErr) {
      // Auto-fallback to stock
      console.warn(`[karaoke/generate-music] provider ${providerKey} failed, falling back to stock:`, providerErr);
      const stockProvider = getMusicProvider("stock");
      musicResult = await stockProvider.generate(input);
      providerKey = "stock";
    }

    const generatedMusicUrl = musicResult.audioUrl;

    // Save to DB
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { generatedMusicUrl },
    });

    // Log to MusicGeneration table
    try {
      await prisma.musicGeneration.create({
        data: {
          userId: recording.userId,
          prompt: promptText.slice(0, 500),
          providerKey,
          modelName: musicResult.modelName || providerKey,
          audioUrl: generatedMusicUrl,
          durationSeconds: Math.round(musicResult.durationSeconds || durationSec),
          costUsd: musicResult.costUsd || 0,
          hasLyrics,
          genre,
          mood,
        },
      });
    } catch (logErr) {
      console.warn("[karaoke/generate-music] MusicGeneration log failed (non-fatal):", logErr);
    }

    return NextResponse.json({
      recordingId,
      generatedMusicUrl,
      provider: providerKey,
      mode: karaokeMode,
      durationSeconds: musicResult.durationSeconds || durationSec,
    });
  } catch (err) {
    console.error("[karaoke/generate-music] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Music generation failed" },
      { status: 500 }
    );
  }
}
