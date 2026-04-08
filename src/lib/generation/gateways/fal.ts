// GioHomeStudio — fal.ai Gateway
// All fal.ai API calls go through this file. No other file calls fal directly.
// Uses queue-based async API: submit → poll → download result.

import axios from "axios";

// Sync endpoint returns results directly (faster for supported models)
const SYNC_URL = "https://fal.run";
// Queue endpoint for long-running models
const QUEUE_URL = process.env.FAL_BASE_URL || "https://queue.fal.run";

function getKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");
  return key;
}

function authHeaders() {
  return { Authorization: `Key ${getKey()}`, "Content-Type": "application/json" };
}

export interface FalImageRequest {
  endpoint: string;       // e.g. "fal-ai/flux/schnell"
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  seed?: number;
  steps?: number;
}

export interface FalVideoRequest {
  endpoint: string;
  prompt: string;
  negativePrompt?: string;
  duration?: number;
  imageUrl?: string;      // for image-to-video
  seed?: number;
}

export interface FalResponse {
  success: boolean;
  imageUrl?: string;      // URL to download the generated image
  videoUrl?: string;      // URL to download the generated video
  images?: { url: string; content_type: string }[];
  error?: string;
  requestId?: string;
}

// Try sync first (fast models return directly), fall back to queue polling
async function submitAndPoll(endpoint: string, input: Record<string, unknown>): Promise<FalResponse> {
  const timeout = parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "180") * 1000;
  const deadline = Date.now() + timeout;

  // Try sync endpoint first — works for fast models like flux/schnell
  try {
    const syncRes = await axios.post(`${SYNC_URL}/${endpoint}`, input, {
      headers: authHeaders(),
      timeout: Math.min(timeout, 120000),
    });
    const syncResult = parseResult(syncRes.data);
    if (syncResult.success) {
      console.log(`[fal] Sync result from ${endpoint}`);
      return syncResult;
    }
  } catch {
    // Sync failed — fall back to queue
    console.log(`[fal] Sync failed for ${endpoint}, trying queue...`);
  }

  try {
    // Submit to queue
    const submitRes = await axios.post(`${QUEUE_URL}/${endpoint}`, { input }, {
      headers: authHeaders(),
      timeout: 30000,
    });

    const requestId = submitRes.data.request_id;
    if (!requestId) {
      // Some endpoints return result directly (sync mode)
      return parseResult(submitRes.data);
    }

    // Poll for completion
    const statusUrl = `${QUEUE_URL}/${endpoint}/requests/${requestId}/status`;
    const resultUrl = `${QUEUE_URL}/${endpoint}/requests/${requestId}`;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000));

      try {
        const statusRes = await axios.get(statusUrl, { headers: authHeaders(), timeout: 10000 });
        const status = statusRes.data.status;

        if (status === "COMPLETED") {
          const resultRes = await axios.get(resultUrl, { headers: authHeaders(), timeout: 30000 });
          return parseResult(resultRes.data);
        }
        if (status === "FAILED") {
          return { success: false, error: `fal generation failed: ${statusRes.data.error ?? "unknown"}`, requestId };
        }
        // IN_QUEUE or IN_PROGRESS — keep polling
      } catch {
        // Transient poll error — retry
      }
    }

    return { success: false, error: "fal generation timed out", requestId };
  } catch (err) {
    const msg = axios.isAxiosError(err) && err.response
      ? `fal ${err.response.status}: ${JSON.stringify(err.response.data?.detail ?? err.response.data?.message ?? err.message).slice(0, 200)}`
      : err instanceof Error ? err.message : String(err);
    console.error(`[fal] ${endpoint} failed:`, msg);
    return { success: false, error: msg };
  }
}

function parseResult(data: Record<string, unknown>): FalResponse {
  // fal responses vary by model. Common patterns:
  // { images: [{ url, content_type }] }
  // { video: { url } }
  // { output: { url } }

  const images = data.images as { url: string; content_type: string }[] | undefined;
  if (images?.length) {
    return { success: true, imageUrl: images[0].url, images };
  }

  const video = data.video as { url: string } | undefined;
  if (video?.url) {
    return { success: true, videoUrl: video.url };
  }

  const output = data.output as string | { url: string } | undefined;
  if (typeof output === "string") {
    return { success: true, imageUrl: output };
  }
  if (output && typeof output === "object" && "url" in output) {
    return { success: true, videoUrl: output.url };
  }

  // Try to find any URL in the response
  const json = JSON.stringify(data);
  const urlMatch = json.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|webp|mp4)/i);
  if (urlMatch) {
    const url = urlMatch[0];
    if (url.endsWith(".mp4")) return { success: true, videoUrl: url };
    return { success: true, imageUrl: url };
  }

  return { success: false, error: `Unexpected fal response format: ${json.slice(0, 300)}` };
}

export async function falGenerateImage(req: FalImageRequest): Promise<FalResponse> {
  const input: Record<string, unknown> = {
    prompt: req.prompt,
    image_size: { width: req.width ?? 1024, height: req.height ?? 1024 },
    num_images: req.numImages ?? 1,
  };
  if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
  if (req.seed) input.seed = req.seed;
  if (req.steps) input.num_inference_steps = req.steps;

  console.log(`[fal] Image: ${req.endpoint}`);
  return submitAndPoll(req.endpoint, input);
}

export async function falGenerateVideo(req: FalVideoRequest): Promise<FalResponse> {
  const input: Record<string, unknown> = {
    prompt: req.prompt,
  };
  if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
  if (req.duration) input.duration = req.duration;
  if (req.imageUrl) input.image_url = req.imageUrl;
  if (req.seed) input.seed = req.seed;

  console.log(`[fal] Video: ${req.endpoint}`);
  return submitAndPoll(req.endpoint, input);
}

export async function downloadFalMedia(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
  return Buffer.from(res.data);
}

export async function isFalConfigured(): Promise<boolean> {
  return !!process.env.FAL_KEY;
}
