// POST /api/video/generate — AI video generation with Smart Provider Routing
//
// Smart routing: automatically picks the cheapest provider for each model
//   Kling 2.x → Kie.ai ($0.125/5s vs fal.ai $0.25) = 50% cheaper
//   Kling 3.0 → fal.ai ($0.50/5s vs Kie.ai $0.80) = 37% cheaper
//   SeeDance 2.0 → fal.ai (only live provider)
//   Hailuo → fal.ai (only provider)
//   Runway → direct API
//
// If cheapest provider fails, auto-fallback to the other
//
// Accepts: { prompt, model, imageUrl, aspectRatio, duration }
// Returns: { outputUrl, provider, model, cost } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

// ── Provider + pricing config ───────────────────────────────────────────────

interface ProviderRoute {
  provider: "fal" | "kie" | "runway" | "kling-direct";
  cost5s: number;
  endpoint?: string;
  kieModel?: string;
}

// Smart routing: cheapest provider first, fallback second
const MODEL_ROUTES: Record<string, ProviderRoute[]> = {
  // ── Animation & Budget ──
  "wan25": [
    { provider: "fal", cost5s: 0.25, endpoint: "fal-ai/wan/v2.5/text-to-video" },
  ],
  "wan25-pro": [
    { provider: "fal", cost5s: 0.35, endpoint: "fal-ai/wan/v2.5/pro/text-to-video" },
  ],
  // ── Standard ──
  "kling2": [
    { provider: "kie", cost5s: 0.125, kieModel: "kling-2.6/text-to-video" },      // 50% cheaper
    { provider: "fal", cost5s: 0.25, endpoint: "fal-ai/kling-video/v1.6/standard/text-to-video" },
  ],
  "kling25-turbo": [
    { provider: "fal", cost5s: 0.35, endpoint: "fal-ai/kling-video/v2.5/turbo/pro/text-to-video" },
  ],
  // ── Premium ──
  "kling3-pro": [
    { provider: "fal", cost5s: 0.50, endpoint: "fal-ai/kling-video/v2/master/text-to-video" }, // 37% cheaper
    { provider: "kie", cost5s: 0.80, kieModel: "kling-3.0/text-to-video" },
  ],
  "seedance": [
    { provider: "fal", cost5s: 0.26, endpoint: "fal-ai/bytedance/seedance-2.0/text-to-video" },
  ],
  // ── Other ──
  "hailuo-pro": [
    { provider: "fal", cost5s: 0.49, endpoint: "fal-ai/minimax/video-01" },
  ],
  "hailuo-fast": [
    { provider: "fal", cost5s: 0.28, endpoint: "fal-ai/minimax/video-01" },
  ],
  "runway": [
    { provider: "runway", cost5s: 0.25 },
  ],
  "kling-direct": [
    { provider: "kling-direct", cost5s: 0.20 },
  ],
};

// ── Categorized model catalog (for UI) ──
// Exported as GET so frontend can fetch model list with categories
export async function GET() {
  const categories = [
    {
      id: "animation", name: "Animation & Budget", description: "Cheapest options for animation, drafts, and children content",
      models: [
        { id: "wan25", name: "Wan 2.5", credits: 2, badge: "Cheapest", best: "Budget animation, drafts" },
        { id: "kling2", name: "Kling 2.1", credits: 1, badge: "Best price", best: "Standard quality, affordable" },
        { id: "hailuo-fast", name: "Hailuo 2.3 Fast", credits: 2, badge: "Fastest", best: "Quick previews" },
      ],
    },
    {
      id: "music_dance", name: "Music Video & Dance", description: "Optimized for dance, performance, and music-driven visuals",
      models: [
        { id: "seedance", name: "SeeDance 2.0", credits: 2, badge: "Dance expert", best: "Dance, choreography, motion" },
        { id: "kling25-turbo", name: "Kling 2.5 Turbo", credits: 3, best: "Fast, good quality music video" },
        { id: "hailuo-pro", name: "Hailuo 2.3 Pro", credits: 4, best: "High-res music visuals" },
      ],
    },
    {
      id: "cinematic", name: "Movie & Cinematic", description: "Premium quality for movies, series, and cinematic content",
      models: [
        { id: "kling3-pro", name: "Kling 3.0 Pro", credits: 4, badge: "Best quality", best: "Cinematic, realistic humans" },
        { id: "seedance", name: "SeeDance 2.0", credits: 2, best: "Native audio + cinematic" },
        { id: "runway", name: "Runway Gen-3", credits: 2, best: "Smooth motion, transitions" },
      ],
    },
    {
      id: "commercial", name: "Commercial & Product", description: "Clean visuals for ads, products, and brand content",
      models: [
        { id: "kling2", name: "Kling 2.1", credits: 1, badge: "Best price", best: "Product shots, clean" },
        { id: "hailuo-pro", name: "Hailuo 2.3 Pro", credits: 4, best: "High quality product visuals" },
        { id: "wan25-pro", name: "Wan 2.5 Pro", credits: 3, best: "Balanced quality and cost" },
      ],
    },
    {
      id: "children", name: "Children & Educational", description: "Safe, bright, affordable for educational content",
      models: [
        { id: "wan25", name: "Wan 2.5", credits: 2, badge: "Cheapest", best: "Animation, safe, bright" },
        { id: "hailuo-fast", name: "Hailuo 2.3 Fast", credits: 2, best: "Quick children content" },
        { id: "kling2", name: "Kling 2.1", credits: 1, best: "Standard quality, affordable" },
      ],
    },
  ];
  return NextResponse.json({ categories, allModels: Object.keys(MODEL_ROUTES) });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function saveVideo(videoUrl: string, prefix: string): Promise<string> {
  const outDir = path.join(env.storagePath, "video", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const videoRes = await fetch(videoUrl);
  const outPath = path.join(outDir, `${prefix}_${Date.now()}.mp4`);
  fs.writeFileSync(outPath, Buffer.from(await videoRes.arrayBuffer()));

  // Auto-save to asset library
  try {
    const assetFile = path.join(env.storagePath, "config", "asset-library.json");
    let assets: Array<Record<string, unknown>> = [];
    try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
    assets.unshift({
      id: `video_gen_${Date.now()}`, type: "video",
      name: `AI Video — ${prefix}`, filePath: outPath,
      tags: ["video", "ai-generated", prefix],
      source: prefix, createdAt: new Date().toISOString(),
    });
    fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
  } catch { /* best effort */ }

  return outPath;
}

function toRelUrl(absPath: string): string {
  return `/api/media/${absPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
}

// ── Provider: fal.ai ────────────────────────────────────────────────────────

async function generateFal(
  prompt: string, endpoint: string, aspectRatio: string, durationSec: number, imageUrl?: string,
): Promise<{ videoUrl: string } | null> {
  const FAL_KEY = process.env.FAL_API_KEY;
  if (!FAL_KEY) return null;

  const body: Record<string, unknown> = { prompt };

  if (endpoint.includes("kling")) {
    body.duration = String(Math.min(durationSec, 10));
    body.aspect_ratio = aspectRatio;
  } else if (endpoint.includes("seedance")) {
    body.duration = Math.min(durationSec, 10);
    body.aspect_ratio = aspectRatio;
  } else {
    body.prompt_optimizer = true;
  }

  if (imageUrl) body.image_url = imageUrl;

  const res = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const videoUrl = data.video?.url ?? data.data?.video_url ?? data.url;
  return videoUrl ? { videoUrl } : null;
}

// ── Provider: Kie.ai ────────────────────────────────────────────────────────

async function generateKie(
  prompt: string, kieModel: string, aspectRatio: string, durationSec: number,
): Promise<{ videoUrl: string } | null> {
  const KIE_KEY = env.music.kieAiApiKey; // reuse same Kie.ai key
  if (!KIE_KEY) return null;

  // Create task
  const createRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: kieModel,
      input: {
        prompt: prompt.slice(0, 1000),
        sound: false,
        aspect_ratio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
        duration: String(Math.min(durationSec, 10)),
      },
    }),
  });

  if (!createRes.ok) return null;
  const createData = await createRes.json();
  const taskId = createData.data?.taskId;
  if (!taskId) return null;

  // Poll for completion (max 3 minutes)
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${KIE_KEY}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const state = pollData.data?.state;

    if (state === "success") {
      try {
        const resultJson = JSON.parse(pollData.data?.resultJson ?? "{}");
        const videoUrl = resultJson.resultUrls?.[0] ?? resultJson.url;
        if (videoUrl) return { videoUrl };
      } catch { /* parse fail */ }
      return null;
    }
    if (state === "fail") return null;
  }

  return null;
}

// ── Provider: Runway ────────────────────────────────────────────────────────

async function generateRunway(prompt: string, durationSec: number): Promise<{ videoUrl: string } | null> {
  const RUNWAY_KEY = process.env.RUNWAY_API_KEY;
  if (!RUNWAY_KEY) return null;

  const res = await fetch(`${env.runway.baseUrl}/v1/image_to_video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${RUNWAY_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ promptText: prompt, model: "gen3a_turbo", duration: Math.min(durationSec, 10) }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.id) return null;

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(`${env.runway.baseUrl}/v1/tasks/${data.id}`, {
      headers: { Authorization: `Bearer ${RUNWAY_KEY}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    if (pollData.status === "SUCCEEDED" && pollData.output?.[0]) return { videoUrl: pollData.output[0] };
    if (pollData.status === "FAILED") return null;
  }
  return null;
}

// ── Provider: Kling Direct ──────────────────────────────────────────────────

async function generateKlingDirect(prompt: string, aspectRatio: string, durationSec: number): Promise<{ videoUrl: string } | null> {
  if (!env.kling.accessKey) return null;

  const jwt = await import("jsonwebtoken");
  const makeToken = () => jwt.default.sign(
    { iss: env.kling.accessKey, exp: Math.floor(Date.now() / 1000) + 1800, nbf: Math.floor(Date.now() / 1000) - 5 },
    env.kling.secretKey,
    { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } }
  );

  const res = await fetch(`${env.kling.baseUrl}/v1/videos/text2video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${makeToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, duration: String(Math.min(durationSec, 10)), aspect_ratio: aspectRatio }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const taskId = data.data?.task_id;
  if (!taskId) return null;

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(`${env.kling.baseUrl}/v1/videos/text2video/${taskId}`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    if (pollData.data?.task_status === "succeed") {
      const videoUrl = pollData.data?.task_result?.videos?.[0]?.url;
      if (videoUrl) return { videoUrl };
    }
    if (pollData.data?.task_status === "failed") return null;
  }
  return null;
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model, imageUrl, aspectRatio, duration: durationSec } = body;

    if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

    const modelId = model ?? "hailuo-fast";
    const routes = MODEL_ROUTES[modelId];

    if (!routes) {
      return NextResponse.json({ error: `Unknown model: ${modelId}` }, { status: 400 });
    }

    const ar = aspectRatio ?? "16:9";
    const dur = durationSec ?? 5;
    const errors: string[] = [];

    // Try each provider in priority order (cheapest first)
    for (const route of routes) {
      try {
        let result: { videoUrl: string } | null = null;

        if (route.provider === "fal" && route.endpoint) {
          result = await generateFal(prompt, route.endpoint, ar, dur, imageUrl);
        } else if (route.provider === "kie" && route.kieModel) {
          result = await generateKie(prompt, route.kieModel, ar, dur);
        } else if (route.provider === "runway") {
          result = await generateRunway(prompt, dur);
        } else if (route.provider === "kling-direct") {
          result = await generateKlingDirect(prompt, ar, dur);
        }

        if (result?.videoUrl) {
          const outPath = await saveVideo(result.videoUrl, `${modelId}_${route.provider}`);

          // Auto-generate thumbnail
          let thumbnailUrl: string | null = null;
          try {
            const { execFile: execFileCb } = await import("child_process");
            const { promisify: prom } = await import("util");
            const execAsync = prom(execFileCb);
            const thumbDir = path.join(env.storagePath, "thumbnails");
            fs.mkdirSync(thumbDir, { recursive: true });
            const thumbPath = path.join(thumbDir, `thumb_${Date.now()}.jpg`);
            await execAsync(env.ffmpegPath, ["-ss", "1", "-i", outPath, "-vframes", "1", "-vf", "scale=640:360", "-q:v", "3", "-y", thumbPath], { timeout: 10000 });
            thumbnailUrl = `/api/media/${thumbPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
          } catch { /* best effort */ }

          return NextResponse.json({
            outputUrl: toRelUrl(outPath),
            thumbnailUrl,
            provider: route.provider,
            model: modelId,
            credits: route.cost5s <= 0.15 ? 1 : route.cost5s <= 0.30 ? 2 : route.cost5s <= 0.40 ? 3 : 4,
            route: `${route.provider} (cheapest available)`,
          });
        }
      } catch (e) {
        errors.push(`${route.provider}: ${e instanceof Error ? e.message : String(e)}`);
        console.warn(`[video] ${route.provider} failed for ${modelId}:`, e);
        // Continue to next provider (fallback)
      }
    }

    return NextResponse.json({
      error: `All providers failed for model ${modelId}. Errors: ${errors.join(" | ")}`,
    }, { status: 503 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
