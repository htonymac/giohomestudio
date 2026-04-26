// POST /api/avatar/create — Full Talking Avatar pipeline
//
// Pipeline: Script (LLM) → Voice (TTS) → Lip-sync (FAL) → B-roll (FAL Wan) → Music (Kie) → Assembly (FFmpeg)
//
// Input:
//   imageUrl       — character portrait
//   topic          — what the avatar should talk about
//   duration       — target seconds (10–120)
//   voice          — ElevenLabs voiceId or "default"
//   style          — "interview" | "commercial" | "story" | "explainer"
//   aspectRatio    — "9:16" | "16:9" | "1:1"
//   addBroll       — boolean, generate B-roll cutaways
//   addMusic       — boolean, add background music
//   tier           — AI tier for script generation
//   onProgress     — NOT used (Server Actions only). Poll via GET /api/avatar/create?jobId=
//
// Output: { videoUrl, script, audioUrl, steps }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

type AITier = "standard" | "pro" | "pro_gpt" | "premium" | "best";

function getModelForTier(tier: AITier): { provider: string; model: string } {
  const map: Record<AITier, { provider: string; model: string }> = {
    standard: { provider: "ollama",    model: "mistral" },
    pro:      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    pro_gpt:  { provider: "openai",    model: "gpt-4o-mini" },
    premium:  { provider: "anthropic", model: "claude-sonnet-4-6" },
    best:     { provider: "anthropic", model: "claude-opus-4-7" },
  };
  return map[tier] ?? map.pro;
}

// ── Script generation ────────────────────────────────────────────────────────

async function generateScript(
  topic: string, durationSec: number, style: string, tier: AITier
): Promise<string> {
  const { provider, model } = getModelForTier(tier);
  const wordCount = Math.round((durationSec / 60) * 130); // ~130 wpm speaking pace

  const systemPrompt = `You write punchy, engaging spoken scripts for short AI avatar videos.
Style: ${style}. Duration: ~${durationSec} seconds (~${wordCount} words).
Rules: No stage directions. No "Scene:" or "[Music]" labels. Just the spoken words.
Open with a strong hook. End with a clear call-to-action or memorable closing.`;

  const userPrompt = `Write a ${style} script about: ${topic}`;

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 600 }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 600, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? "";
  }

  // Ollama fallback
  const res = await fetch(`${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ model: "mistral", prompt: `${systemPrompt}\n\n${userPrompt}`, stream: false }),
  });
  const data = await res.json();
  return data.response?.trim() ?? topic;
}

// ── TTS ──────────────────────────────────────────────────────────────────────

async function generateVoice(text: string, voiceId: string): Promise<string> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3200"}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId: voiceId !== "default" ? voiceId : undefined }),
  });
  const data = await res.json();
  if (!data.audioUrl) throw new Error("TTS failed: " + (data.error || "no audio"));
  return data.audioUrl;
}

// ── Lip-sync ─────────────────────────────────────────────────────────────────

async function generateLipSync(imageUrl: string, audioUrl: string, aspectRatio: string): Promise<string> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3200"}/api/avatar/lip-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, audioUrl, aspectRatio }),
  });
  const data = await res.json();
  if (!data.videoUrl) throw new Error("Lip-sync failed: " + (data.error || "no video"));
  return data.videoUrl;
}

// ── B-roll (optional) ─────────────────────────────────────────────────────────

async function generateBroll(topic: string, aspectRatio: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3200"}/api/video/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `Cinematic B-roll footage for: ${topic}`, model: "wan25", aspectRatio, duration: 5 }),
    });
    const data = await res.json();
    return data.outputUrl ?? null;
  } catch { return null; }
}

// ── Background music (optional) ───────────────────────────────────────────────

async function generateMusic(style: string, durationSec: number): Promise<string | null> {
  try {
    const styleMap: Record<string, string> = {
      interview: "calm ambient background",
      commercial: "upbeat energetic brand music",
      story: "emotional cinematic underscore",
      explainer: "light corporate background music",
    };
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3200"}/api/music/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: styleMap[style] || "ambient background", duration: durationSec, instrumental: true }),
    });
    const data = await res.json();
    return data.audioUrl ?? data.url ?? null;
  } catch { return null; }
}

// ── FFmpeg assembly ───────────────────────────────────────────────────────────

async function assembleVideo(
  avatarVideoUrl: string,
  brollUrl: string | null,
  musicUrl: string | null,
  durationSec: number,
): Promise<string> {
  const outDir = path.join(env.storagePath, "video", "avatar");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `avatar_final_${Date.now()}.mp4`);

  const baseVideo = avatarVideoUrl.startsWith("/api/media")
    ? path.join(env.storagePath, avatarVideoUrl.replace("/api/media/", ""))
    : avatarVideoUrl;

  const { execFile: execFileCb } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(execFileCb);

  if (musicUrl) {
    const musicPath = musicUrl.startsWith("/api/media")
      ? path.join(env.storagePath, musicUrl.replace("/api/media/", ""))
      : musicUrl;

    await execAsync(env.ffmpegPath, [
      "-i", baseVideo,
      "-i", musicPath,
      "-filter_complex", `[1:a]volume=0.15,apad[music];[0:a][music]amix=inputs=2:duration=first[aout]`,
      "-map", "0:v",
      "-map", "[aout]",
      "-t", String(durationSec),
      "-c:v", "copy",
      "-c:a", "aac",
      "-y", outPath,
    ], { timeout: 120000 });
  } else {
    await execAsync(env.ffmpegPath, [
      "-i", baseVideo,
      "-t", String(durationSec),
      "-c", "copy",
      "-y", outPath,
    ], { timeout: 60000 });
  }

  return `/api/media/${outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
}

// ── Job store (in-memory, good enough for single-server MVP) ──────────────────

interface AvatarJob {
  id: string;
  status: "queued" | "running" | "done" | "error";
  step: string;
  steps: { name: string; status: "pending" | "done" | "error" }[];
  result?: { videoUrl: string; script: string; audioUrl: string };
  error?: string;
  createdAt: number;
}

const JOBS = new Map<string, AvatarJob>();

// ── GET — poll job status ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = JOBS.get(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(job);
}

// ── POST — start avatar creation ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageUrl,
      topic = "Tell the world about your amazing product",
      duration = 30,
      voice = "default",
      style = "commercial",
      aspectRatio = "9:16",
      addBroll = false,
      addMusic = true,
      tier = "pro" as AITier,
    } = body;

    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const jobId = `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: AvatarJob = {
      id: jobId,
      status: "queued",
      step: "Starting",
      steps: [
        { name: "Writing script", status: "pending" },
        { name: "Generating voice", status: "pending" },
        { name: "Lip-sync animation", status: "pending" },
        ...(addBroll ? [{ name: "B-roll footage", status: "pending" as const }] : []),
        ...(addMusic ? [{ name: "Background music", status: "pending" as const }] : []),
        { name: "Final assembly", status: "pending" },
      ],
      createdAt: Date.now(),
    };

    JOBS.set(jobId, job);

    // Run pipeline async so we can return jobId immediately
    (async () => {
      const stepDone = (name: string) => {
        const s = job.steps.find(x => x.name === name);
        if (s) s.status = "done";
      };
      const stepFail = (name: string) => {
        const s = job.steps.find(x => x.name === name);
        if (s) s.status = "error";
      };

      try {
        job.status = "running";

        // Step 1: Script
        job.step = "Writing script";
        const script = await generateScript(topic, duration, style, tier);
        stepDone("Writing script");

        // Step 2: Voice
        job.step = "Generating voice";
        const audioUrl = await generateVoice(script, voice);
        stepDone("Generating voice");

        // Step 3: Lip-sync
        job.step = "Lip-sync animation";
        const avatarVideoUrl = await generateLipSync(imageUrl, audioUrl, aspectRatio);
        stepDone("Lip-sync animation");

        // Step 4: B-roll (optional, parallel with music)
        let brollUrl: string | null = null;
        let musicUrl: string | null = null;

        const parallel: Promise<void>[] = [];

        if (addBroll) {
          parallel.push(
            generateBroll(topic, aspectRatio)
              .then(url => { brollUrl = url; stepDone("B-roll footage"); })
              .catch(() => stepFail("B-roll footage"))
          );
        }

        if (addMusic) {
          parallel.push(
            generateMusic(style, duration)
              .then(url => { musicUrl = url; stepDone("Background music"); })
              .catch(() => stepFail("Background music"))
          );
        }

        if (parallel.length) await Promise.allSettled(parallel);

        // Step 5: Assembly
        job.step = "Final assembly";
        const finalUrl = await assembleVideo(avatarVideoUrl, brollUrl, musicUrl, duration);
        stepDone("Final assembly");

        job.status = "done";
        job.step = "Complete";
        job.result = { videoUrl: finalUrl, script, audioUrl };

      } catch (e) {
        job.status = "error";
        job.error = e instanceof Error ? e.message : String(e);
        const currentStep = job.steps.find(s => s.status === "pending");
        if (currentStep) currentStep.status = "error";
      }
    })();

    return NextResponse.json({ jobId, status: "queued", pollUrl: `/api/avatar/create?jobId=${jobId}` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to start" }, { status: 500 });
  }
}
