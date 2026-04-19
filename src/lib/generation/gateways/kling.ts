// GioHomeStudio — Kling Direct API Gateway
// Direct Kling API (api.klingai.com) — no FAL middleman.
// Auth: JWT HS256 signed with KLING_ACCESS_KEY + KLING_SECRET_KEY
// Flow: POST /v1/videos/image2video → poll GET /v1/videos/image2video/{task_id}

import axios from "axios";
import * as crypto from "crypto";

function getCredentials() {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
  if (!accessKey || !secretKey) throw new Error("KLING_ACCESS_KEY or KLING_SECRET_KEY not set");
  return { accessKey, secretKey };
}

const BASE_URL = () => (process.env.KLING_API_BASE_URL || "https://api.klingai.com").replace(/\/$/, "");

// ── JWT token generation (HS256) ────────────────────────────────────────────
function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(): string {
  const { accessKey, secretKey } = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64urlEncode(Buffer.from(JSON.stringify({
    iss: accessKey,
    exp: now + 1800,   // 30 min expiry
    nbf: now - 5,      // valid from 5s ago (clock skew)
  })));
  const sigInput = `${header}.${payload}`;
  const sig = base64urlEncode(crypto.createHmac("sha256", secretKey).update(sigInput).digest());
  return `${sigInput}.${sig}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${makeJwt()}`,
    "Content-Type": "application/json",
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface KlingVideoRequest {
  // Valid Kling model names (confirmed via API):
  // kling-v1, kling-v1-5, kling-v1-6, kling-v2-1, kling-v2-master
  model: "kling-v1" | "kling-v1-5" | "kling-v1-6" | "kling-v2-1" | "kling-v2-master";
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;       // publicly accessible image URL
  duration?: 5 | 10;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  cfgScale?: number;      // 0.0–1.0, creativity level
  mode?: "std" | "pro";
}

export interface KlingVideoResponse {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  error?: string;
}

export type KlingProgressCallback = (evt: { percent: number; message: string }) => void;

// ── Submit + Poll ────────────────────────────────────────────────────────────

export async function klingGenerateVideo(
  req: KlingVideoRequest,
  onProgress?: KlingProgressCallback,
): Promise<KlingVideoResponse> {
  const timeout = parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "600") * 1000;
  const deadline = Date.now() + timeout;
  const base = BASE_URL();

  try {
    onProgress?.({ percent: 8, message: "Submitting to Kling Direct API..." });

    // ── Step 1: Submit image-to-video task ───────────────────────────────
    const body: Record<string, unknown> = {
      model_name: req.model,
      prompt: req.prompt,
      image: req.imageUrl,
      duration: String(req.duration ?? 5),
      aspect_ratio: req.aspectRatio ?? "16:9",
    };
    if (req.negativePrompt) body.negative_prompt = req.negativePrompt;
    if (req.cfgScale != null) body.cfg_scale = req.cfgScale;
    if (req.mode) body.mode = req.mode;

    console.log(`[kling] Submitting ${req.model} ${req.duration ?? 5}s image2video`);

    const submitRes = await axios.post(`${base}/v1/videos/image2video`, body, {
      headers: authHeaders(),
      timeout: 30000,
    });

    const code = submitRes.data?.code;
    if (code !== 0) {
      const msg = submitRes.data?.message ?? JSON.stringify(submitRes.data);
      return { success: false, error: `Kling submit failed (code ${code}): ${msg}` };
    }

    const taskId: string = submitRes.data?.data?.task_id;
    if (!taskId) {
      return { success: false, error: `Kling: no task_id in response: ${JSON.stringify(submitRes.data).slice(0, 200)}` };
    }

    console.log(`[kling] task_id: ${taskId}`);
    onProgress?.({ percent: 15, message: "Kling job submitted — waiting for worker..." });

    // ── Step 2: Poll for completion ──────────────────────────────────────
    let pollCount = 0;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      pollCount++;

      let taskStatus: string | undefined;
      let taskResult: Record<string, unknown> | undefined;

      try {
        const statusRes = await axios.get(`${base}/v1/videos/image2video/${taskId}`, {
          headers: authHeaders(),
          timeout: 15000,
        });

        if (statusRes.data?.code !== 0) {
          // Non-fatal API error — retry
          console.warn(`[kling] poll code ${statusRes.data?.code} — retrying`);
          continue;
        }

        taskStatus = statusRes.data?.data?.task_status as string | undefined;
        taskResult = statusRes.data?.data?.task_result as Record<string, unknown> | undefined;

        const pct = Math.min(88, 20 + pollCount * 5);

        if (taskStatus === "failed") {
          const errMsg = statusRes.data?.data?.task_status_msg ?? "unknown";
          return { success: false, error: `Kling task failed: ${errMsg}`, taskId };
        }
        if (taskStatus === "submitted") {
          onProgress?.({ percent: pct, message: `Kling queued... (${pollCount * 5}s)` });
        } else if (taskStatus === "processing") {
          onProgress?.({ percent: pct, message: `Kling generating... (~${pollCount * 5}s elapsed)` });
        }
      } catch (pollErr) {
        console.warn(`[kling] poll error (retry):`, pollErr instanceof Error ? pollErr.message : String(pollErr));
        continue;
      }

      if (taskStatus === "succeed") {
        onProgress?.({ percent: 92, message: "Kling complete — fetching video..." });
        const videos = (taskResult?.videos as { url: string; duration: string }[] | undefined) ?? [];
        const videoUrl = videos[0]?.url;
        if (videoUrl) {
          console.log(`[kling] success: ${videoUrl.slice(0, 80)}`);
          return { success: true, videoUrl, taskId };
        }
        return { success: false, error: `Kling succeeded but no video URL found. Result: ${JSON.stringify(taskResult).slice(0, 200)}`, taskId };
      }
    }

    return { success: false, error: "Kling generation timed out", taskId: undefined };

  } catch (err) {
    const msg = axios.isAxiosError(err) && err.response
      ? `Kling API ${err.response.status}: ${JSON.stringify(err.response.data?.message ?? err.response.data).slice(0, 200)}`
      : err instanceof Error ? err.message : String(err);
    console.error(`[kling] error:`, msg);
    return { success: false, error: msg };
  }
}

export async function downloadKlingVideo(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 120000 });
  return Buffer.from(res.data);
}

export async function isKlingDirectConfigured(): Promise<boolean> {
  return !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY);
}
