// POST /api/ad-editor/gemini-tts
// Generates voice-over audio using Gemini 3.1 Flash TTS via fal.ai
// Returns a saved audio URL that can be used in the ad editor or commercial planner.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export const maxDuration = 120;

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || "";

interface TtsRequest {
  text: string;
  voice?: string;          // voice name or style hint
  speed?: number;          // 0.5–2.0, default 1.0
  pitch?: "low" | "medium" | "high";
  projectId?: string;
}

const VOICE_OPTIONS = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir",
  "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
];

export async function POST(req: NextRequest) {
  const body: TtsRequest = await req.json();
  const { text, voice = "Aoede", speed = 1.0, pitch = "medium", projectId } = body;

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (!FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  // Build prompt with optional inline audio tags
  const speedTag = speed !== 1.0 ? `<speed value="${speed}">` : "";
  const speedClose = speed !== 1.0 ? "</speed>" : "";
  const pitchTag = pitch !== "medium" ? `<pitch value="${pitch}">` : "";
  const pitchClose = pitch !== "medium" ? "</pitch>" : "";
  const fullText = `${speedTag}${pitchTag}${text}${pitchClose}${speedClose}`;

  // Migrated to providers/fal adapter (Henry 2026-05-30 task #29).
  const { falGeminiTts } = await import("@/lib/providers/fal");
  const falRes = await falGeminiTts({ text: fullText, voiceName: voice });

  if (!falRes.ok) {
    return NextResponse.json({ error: `FAL error: ${falRes.error.slice(0, 200)}` }, { status: 502 });
  }

  const falData = falRes.data;
  const audioUrl: string = falData.audio?.url || falData.audio_url || "";
  if (!audioUrl) {
    return NextResponse.json({ error: "No audio URL in response", raw: falData }, { status: 500 });
  }

  // Download and save to storage
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    return NextResponse.json({ error: "Failed to download audio from FAL" }, { status: 502 });
  }
  const buf = Buffer.from(await audioRes.arrayBuffer());

  const outDir = path.join(env.storagePath, "audio", "tts");
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `gemini_tts_${Date.now()}.wav`;
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, buf);

  const outputUrl = `/api/media/audio/tts/${filename}`;

  return NextResponse.json({
    ok: true,
    outputUrl,
    voice,
    duration: falData.duration ?? null,
    projectId,
  });
}

export async function GET() {
  return NextResponse.json({ voices: VOICE_OPTIONS });
}
