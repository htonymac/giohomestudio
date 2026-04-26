// GioHomeStudio — MuAPI Gateway
// MuAPI is a cheaper alternative to FAL for Seedance, Wan, and other video models.
// All MuAPI calls go through this file. No other file calls MuAPI directly.
//
// API flow confirmed from live OpenAPI spec + test submission:
//   1. POST /api/v1/{endpoint}  — body: { prompt, image_url, resolution?, duration? }
//   2. Response: { request_id, status }
//   3. Poll: GET /api/v1/predictions/{request_id}/result
//   4. Done: { status: "completed", outputs: ["https://...mp4"] }

import axios from "axios";

function getKey(): string {
  const key = process.env.MUAPI_API_KEY;
  if (!key) throw new Error("MUAPI_API_KEY not set");
  return key;
}

const BASE_URL = () => (process.env.MUAPI_BASE_URL || "https://api.muapi.ai").replace(/\/$/, "");

function authHeaders() {
  return {
    "x-api-key": getKey(),
    "Content-Type": "application/json",
  };
}

export interface MuApiVideoRequest {
  endpoint: string;           // e.g. "seedance-pro-i2v" — appended to /api/v1/
  prompt: string;
  imageUrl: string;           // publicly accessible URL (upload to FAL CDN first if localhost)
  duration?: number;          // seconds (3–12 for Seedance, ignored for Wan)
  resolution?: "480p" | "720p" | "1080p"; // Seedance only; Wan uses aspect_ratio
  aspectRatio?: "16:9" | "9:16";          // Wan models (default 16:9)
}

export interface MuApiResponse {
  success: boolean;
  videoUrl?: string;
  jobId?: string;
  error?: string;
}

export type MuApiProgressCallback = (event: { percent: number; message: string }) => void;

export async function muapiGenerateVideo(
  req: MuApiVideoRequest,
  onProgress?: MuApiProgressCallback,
): Promise<MuApiResponse> {
  const timeout = parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "600") * 1000;
  const deadline = Date.now() + timeout;
  const base = BASE_URL();

  try {
    onProgress?.({ percent: 8, message: "Submitting to MuAPI..." });

    // ── Step 1: Submit job ─────────────────────────────────────
    const body: Record<string, unknown> = {
      prompt: req.prompt,
      image_url: req.imageUrl,
    };
    // Seedance params
    if (req.duration !== undefined) body.duration = Math.max(3, Math.min(12, req.duration));
    if (req.resolution) body.resolution = req.resolution;
    // Wan params
    if (req.aspectRatio) body.aspect_ratio = req.aspectRatio;

    const submitRes = await axios.post(
      `${base}/api/v1/${req.endpoint}`,
      body,
      { headers: authHeaders(), timeout: 30000 },
    );

    // ── Extract job ID (MuAPI returns "request_id") ────────────
    const jobId: string | undefined = submitRes.data?.request_id;

    // Sync mode: job already done (rare but handle it)
    const directUrl: string | undefined =
      Array.isArray(submitRes.data?.outputs) && submitRes.data.outputs.length > 0
        ? submitRes.data.outputs[0]
        : undefined;

    if (directUrl) {
      console.log(`[muapi] Sync result from ${req.endpoint}`);
      return { success: true, videoUrl: directUrl };
    }

    if (!jobId) {
      return {
        success: false,
        error: `MuAPI did not return a request_id. Raw: ${JSON.stringify(submitRes.data).slice(0, 200)}`,
      };
    }

    console.log(`[muapi] Job submitted: ${jobId} (${req.endpoint})`);
    onProgress?.({ percent: 15, message: "MuAPI job queued — waiting for worker..." });

    // ── Step 2: Poll /api/v1/predictions/{request_id}/result ──
    const pollUrl = `${base}/api/v1/predictions/${jobId}/result`;
    let pollCount = 0;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      pollCount++;

      try {
        const res = await axios.get(pollUrl, { headers: authHeaders(), timeout: 15000 });
        const d = res.data as Record<string, unknown>;

        const status: string = ((d.status as string) ?? "processing").toLowerCase();
        console.log(`[muapi] ${jobId} status=${status} poll=${pollCount}`);

        if (status === "completed" || status === "succeeded" || status === "success" || status === "finished") {
          // outputs is an array of video URLs
          const outputs = d.outputs as string[] | undefined;
          const videoUrl = Array.isArray(outputs) && outputs.length > 0 ? outputs[0] : undefined;

          if (!videoUrl) {
            return { success: false, jobId, error: "MuAPI job completed but outputs[] is empty" };
          }
          onProgress?.({ percent: 95, message: "MuAPI generation complete — downloading..." });
          return { success: true, videoUrl, jobId };
        }

        if (status === "failed" || status === "error" || status === "cancelled") {
          const reason = d.error ?? d.message ?? d.failure ?? "unknown error";
          return { success: false, jobId, error: `MuAPI job ${status}: ${reason}` };
        }

        // Still processing / queued
        const pct = status === "processing" || status === "running"
          ? Math.min(88, 25 + pollCount * 5)
          : Math.min(30, 15 + pollCount * 2);
        onProgress?.({
          percent: pct,
          message: status === "processing" || status === "running"
            ? `MuAPI generating... (~${pollCount * 5}s elapsed)`
            : `MuAPI queued — waiting for worker... (${pollCount * 5}s)`,
        });

      } catch (pollErr) {
        // MuAPI returns HTTP 400 when a job fails — extract the error from the response
        if (axios.isAxiosError(pollErr) && pollErr.response?.status === 400) {
          const detail = pollErr.response.data?.detail as Record<string, unknown> | undefined;
          if (detail?.status === "failed" || detail?.status === "error") {
            return { success: false, jobId, error: `MuAPI job failed: ${detail.error ?? detail.message ?? "unknown"}` };
          }
        }
        // transient network error — keep retrying
        console.warn(`[muapi] poll error (attempt ${pollCount}):`, pollErr instanceof Error ? pollErr.message : pollErr);
      }
    }

    return { success: false, jobId, error: "MuAPI generation timed out" };

  } catch (err) {
    const msg = axios.isAxiosError(err) && err.response
      ? `MuAPI ${err.response.status}: ${JSON.stringify(err.response.data?.detail ?? err.response.data).slice(0, 300)}`
      : err instanceof Error ? err.message : String(err);
    console.error("[muapi] generation failed:", msg);
    return { success: false, error: msg };
  }
}

export async function downloadMuApiVideo(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 120000 });
  return Buffer.from(res.data);
}

export async function isMuApiConfigured(): Promise<boolean> {
  return !!process.env.MUAPI_API_KEY;
}
