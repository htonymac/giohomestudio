// GioHomeStudio — Segmind Gateway
// All Segmind API calls go through this file. No other file calls Segmind directly.

import axios from "axios";

const BASE_URL = process.env.SEGMIND_BASE_URL || "https://api.segmind.com/v1";

function getKey(): string {
  const key = process.env.SEGMIND_API_KEY;
  if (!key) throw new Error("SEGMIND_API_KEY not set");
  return key;
}

export interface SegmindImageRequest {
  endpoint: string;      // e.g. "pruna-p-image"
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  // image edit fields
  image?: string;        // base64 for edit models
  strength?: number;
}

export interface SegmindVideoRequest {
  endpoint: string;
  prompt: string;
  negativePrompt?: string;
  duration?: number;     // seconds
  seed?: number;
  image?: string;        // base64 for image-to-video
}

export interface SegmindResponse {
  success: boolean;
  data?: Buffer;         // raw image/video bytes
  contentType?: string;
  error?: string;
}

export async function segmindGenerateImage(req: SegmindImageRequest): Promise<SegmindResponse> {
  const timeout = (parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "180") * 1000);
  const maxRetries = parseInt(process.env.MAX_RETRIES ?? "2");

  const body: Record<string, unknown> = {
    prompt: req.prompt,
    negative_prompt: req.negativePrompt ?? "",
    width: req.width ?? 1024,
    height: req.height ?? 1024,
    steps: req.steps ?? 25,
    seed: req.seed ?? Math.floor(Math.random() * 2 ** 32),
  };

  if (req.image) body.image = req.image;
  if (req.strength !== undefined) body.strength = req.strength;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(`${BASE_URL}/${req.endpoint}`, body, {
        headers: { "x-api-key": getKey(), "Content-Type": "application/json" },
        responseType: "arraybuffer",
        timeout,
      });

      const ct = res.headers["content-type"] ?? "image/png";
      return { success: true, data: Buffer.from(res.data), contentType: ct };
    } catch (err) {
      if (attempt < maxRetries && axios.isAxiosError(err) && (!err.response || err.response.status >= 500)) {
        console.warn(`[Segmind] Retry ${attempt + 1}/${maxRetries} for ${req.endpoint}`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      const msg = axios.isAxiosError(err) && err.response
        ? `Segmind ${err.response.status}: ${Buffer.from(err.response.data).toString().slice(0, 200)}`
        : err instanceof Error ? err.message : String(err);
      console.error(`[Segmind] ${req.endpoint} failed:`, msg);
      return { success: false, error: msg };
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

export async function segmindGenerateVideo(req: SegmindVideoRequest): Promise<SegmindResponse> {
  const timeout = (parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "180") * 1000);

  const body: Record<string, unknown> = {
    prompt: req.prompt,
    negative_prompt: req.negativePrompt ?? "",
    duration: req.duration ?? 5,
    seed: req.seed ?? Math.floor(Math.random() * 2 ** 32),
  };

  if (req.image) body.image = req.image;

  try {
    const res = await axios.post(`${BASE_URL}/${req.endpoint}`, body, {
      headers: { "x-api-key": getKey(), "Content-Type": "application/json" },
      responseType: "arraybuffer",
      timeout,
    });

    const ct = res.headers["content-type"] ?? "video/mp4";
    return { success: true, data: Buffer.from(res.data), contentType: ct };
  } catch (err) {
    const msg = axios.isAxiosError(err) && err.response
      ? `Segmind ${err.response.status}: ${Buffer.from(err.response.data).toString().slice(0, 200)}`
      : err instanceof Error ? err.message : String(err);
    console.error(`[Segmind] ${req.endpoint} video failed:`, msg);
    return { success: false, error: msg };
  }
}

export async function isSegmindConfigured(): Promise<boolean> {
  return !!process.env.SEGMIND_API_KEY;
}
