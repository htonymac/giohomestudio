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

  // Piper fallback
  const plainText = buildPlainText(plan);
  try {
    const piperRes = await fetch("http://localhost:5000/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: plainText,
        voice: voiceId ?? "en_US-lessac-medium",
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!piperRes.ok) {
      throw new Error(`Piper TTS ${piperRes.status}`);
    }

    const buffer = Buffer.from(await piperRes.arrayBuffer());
    fs.writeFileSync(outPath, buffer);

    return NextResponse.json({ ok: true, audioUrl, durationMs, timingMap });
  } catch (err) {
    console.error("children/generate-narration: Piper fallback failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "All TTS providers failed. Configure ELEVENLABS_API_KEY or run Piper on port 5000." },
      { status: 502 }
    );
  }
}
