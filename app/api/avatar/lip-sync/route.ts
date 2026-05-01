// POST /api/avatar/lip-sync — FAL lip-sync wrapper
// Tries fal-ai/hedra-character-1 first (best quality), falls back to fal-ai/lip-sync
// Input: { imageUrl, audioUrl, aspectRatio? }
// Output: { videoUrl, provider }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const FAL_KEY = () => process.env.FAL_KEY || process.env.FAL_API_KEY || "";

async function falQueue(endpoint: string, body: Record<string, unknown>): Promise<string> {
  const key = FAL_KEY();
  if (!key) throw new Error("FAL_KEY not configured");

  const res = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`FAL submit ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const reqId: string = data.request_id;

  if (!reqId) {
    const url = data.video?.url ?? data.output?.video?.url ?? data.url;
    if (url) return url;
    throw new Error(`FAL no request_id. Keys: ${Object.keys(data).join(", ")}`);
  }

  // Poll up to 5 minutes (60 × 5s)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const statusRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${reqId}/status`, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${reqId}`, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!resultRes.ok) throw new Error("FAL result fetch failed");
      const result = await resultRes.json();
      const url = result.video?.url ?? result.output?.video?.url ?? result.url;
      if (url) return url;
      throw new Error(`FAL completed but no video URL. Keys: ${Object.keys(result).join(", ")}`);
    }

    if (statusData.status === "FAILED") {
      throw new Error(`FAL job failed: ${statusData.error || "unknown reason"}`);
    }
  }

  throw new Error("FAL lip-sync timed out after 5 minutes");
}

async function saveVideo(videoUrl: string, prefix: string): Promise<string> {
  const outDir = path.join(env.storagePath, "video", "avatar");
  fs.mkdirSync(outDir, { recursive: true });
  const res = await fetch(videoUrl);
  const outPath = path.join(outDir, `${prefix}_${Date.now()}.mp4`);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, audioUrl, aspectRatio = "9:16" } = await req.json();

    if (!imageUrl || !audioUrl) {
      return NextResponse.json({ error: "imageUrl and audioUrl required" }, { status: 400 });
    }

    let videoUrl: string | null = null;
    let usedProvider = "";
    const providerErrors: string[] = [];

    // Try 1: Hedra Character (talking portrait, best quality)
    try {
      videoUrl = await falQueue("fal-ai/hedra-character-1", {
        image_url: imageUrl,
        audio_url: audioUrl,
        aspect_ratio: aspectRatio,
      });
      usedProvider = "hedra";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[lip-sync] hedra failed, trying fal lip-sync:", msg);
      providerErrors.push(`hedra: ${msg}`);
    }

    // Try 2: Generic FAL lip-sync
    if (!videoUrl) {
      try {
        videoUrl = await falQueue("fal-ai/lip-sync", {
          video_url: imageUrl, // lip-sync needs a still or video
          audio_url: audioUrl,
        });
        usedProvider = "fal-lip-sync";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[lip-sync] fal lip-sync also failed:", msg);
        providerErrors.push(`fal-lip-sync: ${msg}`);
      }
    }

    // Try 3: sync-lipsync (most reliable FAL lip-sync model)
    if (!videoUrl) {
      try {
        videoUrl = await falQueue("fal-ai/sync-lipsync", {
          video_url: imageUrl,
          audio_url: audioUrl,
        });
        // fal-ai/sync-lipsync returns { video: { url } } — falQueue already handles this via url path
        usedProvider = "sync-lipsync";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[lip-sync] sync-lipsync also failed:", msg);
        providerErrors.push(`sync-lipsync: ${msg}`);
      }
    }

    if (!videoUrl) {
      const detail = providerErrors.join(" | ");
      console.error("[lip-sync] all providers exhausted:", detail);
      return NextResponse.json(
        {
          error: "All lip-sync providers failed",
          providers: {
            hedra: providerErrors.find(e => e.startsWith("hedra:")) ?? "not tried",
            "fal-lip-sync": providerErrors.find(e => e.startsWith("fal-lip-sync:")) ?? "not tried",
            "sync-lipsync": providerErrors.find(e => e.startsWith("sync-lipsync:")) ?? "not tried",
          },
          detail,
        },
        { status: 502 }
      );
    }

    const outPath = await saveVideo(videoUrl, `lipsync_${usedProvider}`);
    const relUrl = `/api/media/${outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;

    return NextResponse.json({ videoUrl: relUrl, rawUrl: videoUrl, provider: usedProvider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lip-sync failed";
    console.error("[lip-sync] unhandled error:", msg);
    return NextResponse.json({ error: `lip-sync failed: ${msg}` }, { status: 500 });
  }
}
