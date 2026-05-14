// POST /api/avatar/lip-sync — FAL lip-sync wrapper
//
// Provider tier (2026-05-08 upgrade — wav2lip alone produced choppy mouth motion):
//   1. fal-ai/musetalk            — newer Tencent model, finer mouth detail (image + audio)
//   2. fal-ai/sync-lipsync        — Sync Labs gold standard (video + audio only — skipped for still photos)
//   3. fal-ai/wav2lip             — original primary, retained as fallback
//   4. fal-ai/sadtalker           — final fallback for realistic portraits
//
// Each tier is tried in order; the first to return a video URL wins. Per-tier errors are
// collected and returned in the 502 body when every tier fails, so the caller can see
// which model rejected the input and why.
//
// Input:  { imageUrl, audioUrl, aspectRatio?, inputIsVideo? }
//   inputIsVideo: when true the route routes to sync-lipsync FIRST (it requires video).
//   When false / missing, sync-lipsync is skipped (it doesn't accept still photos).
// Output: { videoUrl, provider, providerErrors? }
//
// Images: uploaded to Imgur (IMGUR_CLIENT_ID) or FAL CDN fallback
// Audio:  uploaded to FAL CDN (FAL_KEY)
// On server: set BASE_URL and no upload is needed at all

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const FAL_KEY = () => process.env.FAL_KEY || process.env.FAL_API_KEY || "";

// Upload an image buffer to Imgur (anonymous, no OAuth needed — only Client-ID).
// Returns the direct image link (https://i.imgur.com/xxx.jpg).
async function uploadToImgur(buffer: Buffer, mimeType: string): Promise<string> {
  const clientId = process.env.IMGUR_CLIENT_ID || "";
  if (!clientId) throw new Error("IMGUR_CLIENT_ID not set");
  const base64 = buffer.toString("base64");
  const res = await fetch("https://api.imgur.com/3/image", {
    method: "POST",
    headers: { Authorization: `Client-ID ${clientId}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, type: "base64" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Imgur upload failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json() as { data?: { link?: string } };
  const link = json.data?.link;
  if (!link) throw new Error("Imgur returned no link");
  // Imgur may return http — force https
  return link.replace(/^http:\/\//, "https://");
}

// Upload audio (or image fallback) to FAL CDN.
// 2-step: POST initiate → PUT bytes to pre-signed URL.
async function uploadToFAL(localPath: string, mimeType: string): Promise<string> {
  const key = FAL_KEY();
  const fileBuffer = fs.readFileSync(localPath);
  const fileName = path.basename(localPath);

  const initRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: mimeType, file_name: fileName }),
  });
  if (!initRes.ok) {
    const t = await initRes.text().catch(() => "");
    throw new Error(`FAL storage initiate failed ${initRes.status}: ${t.slice(0, 200)}`);
  }
  const { upload_url, file_url } = await initRes.json() as { upload_url: string; file_url: string };
  if (!upload_url || !file_url) throw new Error("FAL storage initiate returned no URLs");

  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: fileBuffer,
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => "");
    throw new Error(`FAL storage PUT failed ${putRes.status}: ${t.slice(0, 200)}`);
  }

  return file_url;
}

// Resolve a local URL to a public URL FAL workers can reach.
// Priority order:
//   1. Already public (http/https) → pass through
//   2. BASE_URL set (server) → prepend BASE_URL, no upload needed
//   3. Image + IMGUR_CLIENT_ID set → upload to Imgur
//   4. Fallback → upload to FAL CDN (audio always uses this path)
async function resolveToPublicUrl(url: string, mediaType: "image" | "audio"): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // Base64 data URL
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL format");
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (mediaType === "image" && process.env.IMGUR_CLIENT_ID) {
      return uploadToImgur(buffer, mimeType);
    }
    // Audio or no Imgur key → FAL CDN inline upload
    const key = FAL_KEY();
    const ext = mimeType.includes("png") ? ".png" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : mimeType.includes("wav") ? ".wav" : ".mp3";
    const initRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: mimeType, file_name: `upload${ext}` }),
    });
    if (!initRes.ok) { const t = await initRes.text().catch(() => ""); throw new Error(`FAL initiate failed ${initRes.status}: ${t.slice(0, 200)}`); }
    const { upload_url, file_url } = await initRes.json() as { upload_url: string; file_url: string };
    if (!upload_url || !file_url) throw new Error("FAL initiate returned no URLs");
    const putRes = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": mimeType }, body: buffer });
    if (!putRes.ok) { const t = await putRes.text().catch(() => ""); throw new Error(`FAL PUT failed ${putRes.status}: ${t.slice(0, 200)}`); }
    return file_url;
  }

  // Local /api/media/... path
  if (url.startsWith("/api/media/")) {
    // On server with BASE_URL set — serve directly, no upload
    const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
    if (baseUrl) return `${baseUrl.replace(/\/$/, "")}${url}`;

    const relativePath = url.replace("/api/media/", "");
    const diskPath = path.join(env.storagePath, relativePath);
    if (!fs.existsSync(diskPath)) throw new Error(`Local media not found: ${diskPath}`);
    const buffer = fs.readFileSync(diskPath);
    const mimeType = mediaType === "image"
      ? (diskPath.endsWith(".png") ? "image/png" : "image/jpeg")
      : (diskPath.endsWith(".wav") ? "audio/wav" : "audio/mpeg");

    // Images → Imgur; Audio → FAL CDN
    if (mediaType === "image" && process.env.IMGUR_CLIENT_ID) {
      return uploadToImgur(buffer, mimeType);
    }
    return uploadToFAL(diskPath, mimeType);
  }

  return url; // fallback — return as-is
}

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
      // FAL returns error details in `detail` array even on COMPLETED status
      if (result.detail && Array.isArray(result.detail)) {
        const errMsg = (result.detail as { msg?: string }[]).map(d => d.msg ?? "unknown").join("; ");
        throw new Error(`FAL model error: ${errMsg}`);
      }
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
    const { imageUrl, audioUrl, aspectRatio: _aspectRatio = "9:16", inputIsVideo = false } = await req.json();

    if (!imageUrl || !audioUrl) {
      return NextResponse.json({ error: "imageUrl and audioUrl required" }, { status: 400 });
    }

    // Upload local files to FAL CDN so FAL workers can access them.
    // The "image" media type also covers video here — FAL CDN doesn't care.
    let publicImageUrl = imageUrl;
    let publicAudioUrl = audioUrl;
    try {
      publicImageUrl = await resolveToPublicUrl(imageUrl, "image");
      publicAudioUrl = await resolveToPublicUrl(audioUrl, "audio");
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      console.error("[lip-sync] upload to FAL failed:", msg);
      return NextResponse.json({ error: `Failed to upload media to FAL storage: ${msg}` }, { status: 500 });
    }

    let videoUrl: string | null = null;
    let usedProvider = "";
    const providerErrors: Record<string, string> = {};

    /**
     * Try a single FAL endpoint. If it succeeds, set videoUrl + usedProvider and return true.
     * If it fails, append to providerErrors and return false so the caller continues.
     * Errors are kept lightweight — full payload only in console.warn for ops.
     */
    async function tryProvider(name: string, endpoint: string, payload: Record<string, unknown>): Promise<boolean> {
      if (videoUrl) return true; // short-circuit if a previous tier already won
      try {
        const result = await falQueue(endpoint, payload);
        if (result) {
          videoUrl = result;
          usedProvider = name;
          return true;
        }
        providerErrors[name] = "no video URL returned";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[lip-sync] ${name} failed:`, msg);
        providerErrors[name] = msg.slice(0, 300);
      }
      return false;
    }

    // ── Tier 1: sync-lipsync — Sync Labs (video-only, gold standard) ──
    // Only tried when caller marked the input as a video. For still photos, skip
    // straight to musetalk/wav2lip/sadtalker which all accept face_url images.
    if (inputIsVideo) {
      await tryProvider("sync-lipsync", "fal-ai/sync-lipsync", {
        video_url: publicImageUrl,
        audio_url: publicAudioUrl,
      });
    }

    // ── Tier 2: musetalk — newer Tencent model with finer mouth detail (image + audio) ──
    // Better than wav2lip for AI-stylized portraits. Same input contract as wav2lip.
    await tryProvider("musetalk", "fal-ai/musetalk", {
      face_url: publicImageUrl,
      audio_url: publicAudioUrl,
    });

    // ── Tier 3: wav2lip — original primary, kept as third fallback ──
    await tryProvider("wav2lip", "fal-ai/wav2lip", {
      face_url: publicImageUrl,
      audio_url: publicAudioUrl,
    });

    // ── Tier 4: sadtalker — final fallback for realistic portraits ──
    await tryProvider("sadtalker", "fal-ai/sadtalker", {
      source_image_url: publicImageUrl,
      driven_audio_url: publicAudioUrl,
    });

    if (!videoUrl) {
      const detail = Object.entries(providerErrors).map(([k, v]) => `${k}: ${v}`).join(" | ");
      console.error("[lip-sync] all providers exhausted:", detail);
      return NextResponse.json(
        {
          error: "All lip-sync providers failed",
          providers: {
            "sync-lipsync": providerErrors["sync-lipsync"] ?? (inputIsVideo ? "not tried" : "skipped (still photo)"),
            musetalk:       providerErrors.musetalk        ?? "not tried",
            wav2lip:        providerErrors.wav2lip         ?? "not tried",
            sadtalker:      providerErrors.sadtalker       ?? "not tried",
          },
          detail,
        },
        { status: 502 }
      );
    }

    const outPath = await saveVideo(videoUrl, `lipsync_${usedProvider}`);
    const relUrl = `/api/media/${outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;

    return NextResponse.json({
      videoUrl: relUrl,
      rawUrl: videoUrl,
      provider: usedProvider,
      // Surface which providers we tried and what failed — handy for debugging in the UI.
      providerErrors: Object.keys(providerErrors).length > 0 ? providerErrors : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lip-sync failed";
    console.error("[lip-sync] unhandled error:", msg);
    return NextResponse.json({ error: `lip-sync failed: ${msg}` }, { status: 500 });
  }
}
