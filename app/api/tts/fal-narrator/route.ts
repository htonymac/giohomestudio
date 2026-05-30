// POST /api/tts/fal-narrator — FAL AI Kokoro TTS endpoint
// Uses fal-ai/kokoro for high-quality narration (between Piper and ElevenLabs tier)
// Returns { audioUrl, engine } or { error }
//
// Supported voices (kokoro american-english): af_sky, af_bella, af_sarah, am_adam, am_michael
// Requires FAL_KEY env var

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { falKokoroTts } from "@/lib/providers/fal";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId, speed } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });
    }

    // Migrated to providers/fal adapter (Henry 2026-05-30 task #24).
    const falRes = await falKokoroTts({
      prompt: text,
      voice: voiceId || "af_sky",
      speed: speed || 1.0,
      variant: "american-english",
    });

    if (!falRes.ok) {
      console.error(`FAL Narrator ${falRes.status}:`, falRes.error.slice(0, 300));
      return NextResponse.json(
        { error: `FAL Narrator ${falRes.status}: ${falRes.error.slice(0, 200)}` },
        { status: falRes.status >= 500 ? 502 : falRes.status }
      );
    }

    const falData = (falRes.raw as { audio_url?: string; audio?: { url?: string } }) || {};
    const remoteUrl = falData.audio_url || falData.audio?.url;

    if (!remoteUrl) {
      return NextResponse.json({ error: "FAL Narrator returned no audio URL" }, { status: 502 });
    }

    // Download and store locally so media route can serve it
    const audioDir = path.join(env.storagePath, "audio", "tts");
    fs.mkdirSync(audioDir, { recursive: true });
    const filename = `fal_${Date.now()}.mp3`;
    const localPath = path.join(audioDir, filename);

    const dlRes = await fetch(remoteUrl);
    if (!dlRes.ok) {
      return NextResponse.json({ error: `Failed to download FAL audio: ${dlRes.status}` }, { status: 502 });
    }
    const buffer = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(localPath, buffer);

    const audioUrl = `/api/media/audio/tts/${filename}`;
    return NextResponse.json({ audioUrl, engine: "fal-narrator", text: text.slice(0, 100) });
  } catch (err) {
    console.error("FAL Narrator route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FAL Narrator failed" },
      { status: 500 }
    );
  }
}
