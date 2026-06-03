import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { ChildrenPacingPlan, ChildrenNarrationTimingEntry } from "@/types/children";

interface GenerateNarrationRequest {
  plan: ChildrenPacingPlan;
  voiceId?: string;
}

function buildSsmlScript(plan: ChildrenPacingPlan): string {
  const rate = plan.mode === "story" ? "slow" : "x-slow";
  const parts: string[] = [`<speak><prosody rate="${rate}">`];

  for (const entry of plan.entries) {
    switch (entry.type) {
      case "story_sentence":
        parts.push(`${entry.text}<break time="${entry.ssmlPause ?? 700}ms"/>`);
        break;
      case "letter_spell":
        parts.push(`${entry.text}<break time="${entry.ssmlPause ?? 1500}ms"/>`);
        break;
      case "word_intro":
      case "word_repeat":
        parts.push(`${entry.text}<break time="${entry.ssmlPause ?? 800}ms"/>`);
        break;
      case "pause":
        parts.push(`<break time="${entry.durationMs}ms"/>`);
        break;
      case "sentence_read":
        parts.push(`${entry.text}<break time="1200ms"/>`);
        break;
    }
  }

  parts.push("</prosody></speak>");
  return parts.join(" ");
}

function buildPlainText(plan: ChildrenPacingPlan): string {
  return plan.entries
    .filter((e) => e.type !== "pause")
    .map((e) => e.text)
    .join(" ");
}

function buildTimingMap(plan: ChildrenPacingPlan): ChildrenNarrationTimingEntry[] {
  let cursor = 0;
  return plan.entries.map((entry) => {
    const start = cursor;
    const end = cursor + entry.durationMs;
    cursor = end;
    return { entryId: entry.entryId, audioStart: start, audioEnd: end };
  });
}

function getChildrenStorageDir(): string {
  const base = process.env.STORAGE_BASE_PATH ?? "./storage";
  return path.resolve(base, "children");
}

export async function POST(req: NextRequest) {
  let body: GenerateNarrationRequest;
  try {
    body = await req.json() as GenerateNarrationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plan, voiceId } = body;

  if (!plan?.entries?.length) {
    return NextResponse.json({ error: "plan with entries is required" }, { status: 400 });
  }

  const storageDir = getChildrenStorageDir();
  fs.mkdirSync(storageDir, { recursive: true });

  const filename = `narration_${Date.now()}.mp3`;
  const outPath = path.join(storageDir, filename);
  const audioUrl = `/api/media/children/${filename}`;
  const timingMap = buildTimingMap(plan);
  const durationMs = plan.totalDurationMs;

  // Try ElevenLabs first
  if (process.env.ELEVENLABS_API_KEY) {
    const ssmlScript = buildSsmlScript(plan);
    const vid = voiceId || "EXAVITQu4vr4xnSDxMaL";

    try {
      const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: ssmlScript,
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.7, similarity_boost: 0.8 },
          }),
        }
      );

      if (!elevenRes.ok) {
        const errBody = await elevenRes.text();
        throw new Error(`ElevenLabs ${elevenRes.status}: ${errBody.slice(0, 200)}`);
      }

      const buffer = Buffer.from(await elevenRes.arrayBuffer());
      fs.writeFileSync(outPath, buffer);

      return NextResponse.json({ ok: true, audioUrl, durationMs, timingMap });
    } catch (err) {
      console.error("children/generate-narration: ElevenLabs failed, falling back to Piper", err instanceof Error ? err.message : err);
    }
  }

  // Henry 2026-06-03 (Sonnet C audit Fix #7): Piper fallback REWIRED.
  // Was calling http://localhost:5000/tts — a Piper HTTP daemon that does
  // not run on the Linux server. Every pacing narration call would silently
  // fail with 502 after 30s. Now call our own /api/tts which has Piper
  // properly configured + path candidate list + scaled timeouts (commit
  // 8807b18 + this session's fixes).
  const plainText = buildPlainText(plan);
  try {
    const origin = process.env.INTERNAL_LOCALHOST_URL || "http://127.0.0.1:3200";
    const piperRes = await fetch(`${origin}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: plainText,
        provider: "piper",
        voiceId: voiceId ?? "en_US-lessac-medium",
      }),
      signal: AbortSignal.timeout(600000), // 10 min cap — same budget as /api/tts internal
    });

    if (!piperRes.ok) {
      throw new Error(`Piper TTS ${piperRes.status}`);
    }

    const ttsData = await piperRes.json() as { audioUrl?: string; engine?: string; durationMs?: number };
    // Reject silent placeholder — would land a 30s beep as the pacing audio.
    if (ttsData.engine === "placeholder") {
      throw new Error("TTS returned silent placeholder — Piper / FAL unavailable on server");
    }
    if (!ttsData.audioUrl) {
      throw new Error("TTS returned no audioUrl");
    }

    // /api/tts wrote its own file. Copy/link it to our outPath so the
    // pacing flow's expected file location holds, then use the real
    // durationMs from the TTS engine if it returned one.
    const ttsPath = ttsData.audioUrl.startsWith("/api/media/")
      ? ttsData.audioUrl.replace("/api/media/", `${process.cwd()}/storage/`)
      : null;
    if (ttsPath && fs.existsSync(ttsPath) && ttsPath !== outPath) {
      try { fs.copyFileSync(ttsPath, outPath); } catch { /* keep original outPath ref */ }
    }

    const realDurationMs = ttsData.durationMs || durationMs;
    return NextResponse.json({ ok: true, audioUrl, durationMs: realDurationMs, timingMap });
  } catch (err) {
    console.error("[children/generate-narration] Piper fallback failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: `Pacing narration failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 }
    );
  }
}
