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
  face_image_url?: string; // PuLID face reference — must be a public URL
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

export type FalProgressCallback = (event: { status: string; percent: number; message: string }) => void;

// Try sync first (fast models return directly), fall back to queue polling
// skipSync=true skips the fal.run attempt — required for video models (they never return sync)
async function submitAndPoll(
  endpoint: string,
  input: Record<string, unknown>,
  skipSync = false,
  onProgress?: FalProgressCallback,
): Promise<FalResponse> {
  const timeout = parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "600") * 1000;
  const deadline = Date.now() + timeout;

  // Try sync endpoint first — only works for fast image models (flux/schnell etc)
  if (!skipSync) {
    try {
      const syncRes = await axios.post(`${SYNC_URL}/${endpoint}`, input, {
        headers: authHeaders(),
        timeout: Math.min(timeout, 60000),
      });
      const syncResult = parseResult(syncRes.data);
      if (syncResult.success) {
        console.log(`[fal] Sync result from ${endpoint}`);
        return syncResult;
      }
    } catch {
      console.log(`[fal] Sync failed for ${endpoint}, trying queue...`);
    }
  }

  try {
    onProgress?.({ status: "submitting", percent: 8, message: "Submitting to FAL queue..." });

    // Submit to queue
    // FAL queue accepts the body flat — wrapping in { input } causes nested-input
    // errors on Kling 1.6/standard, Wan 2.5, etc. Mirrors app/api/video/generate logic.
    const submitRes = await axios.post(`${QUEUE_URL}/${endpoint}`, input, {
      headers: authHeaders(),
      timeout: 30000,
    });

    const requestId = submitRes.data.request_id;
    if (!requestId) {
      return parseResult(submitRes.data);
    }

    onProgress?.({ status: "queued", percent: 15, message: "Queued — waiting for worker..." });

    // Use URLs returned by FAL — they strip the version path (e.g. /v2.5/standard)
    // so constructing from endpoint causes 404s on Kling, Wan, etc.
    const statusUrl: string = submitRes.data.status_url
      ?? `${QUEUE_URL}/${endpoint}/requests/${requestId}/status`;
    const resultUrl: string = submitRes.data.response_url
      ?? `${QUEUE_URL}/${endpoint}/requests/${requestId}`;

    console.log(`[fal] polling statusUrl: ${statusUrl}`);

    let pollCount = 0;
    let inProgressCount = 0;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000));
      pollCount++;

      let status: string | undefined;
      try {
        const statusRes = await axios.get(statusUrl, { headers: authHeaders(), timeout: 10000 });
        status = statusRes.data.status as string | undefined;

        if (status === "FAILED") {
          return { success: false, error: `FAL generation failed: ${statusRes.data.error ?? "unknown"}`, requestId };
        }
        if (status === "IN_QUEUE") {
          const qp = statusRes.data.queue_position;
          const pct = Math.min(45, 15 + pollCount);
          onProgress?.({ status: "in_queue", percent: pct, message: qp != null ? `Queue position: ${qp}` : "In queue..." });
        } else if (status === "IN_PROGRESS") {
          inProgressCount++;
          const pct = Math.min(88, 45 + inProgressCount * 4);
          onProgress?.({ status: "generating", percent: pct, message: "Generating video..." });
        }
      } catch {
        // Transient poll error — retry next cycle
        continue;
      }

      // Fetch result OUTSIDE the poll try/catch so errors surface properly
      if (status === "COMPLETED") {
        onProgress?.({ status: "completed", percent: 92, message: "Downloading result from FAL..." });
        try {
          const resultRes = await axios.get(resultUrl, { headers: authHeaders(), timeout: 60000 });
          const parsed = parseResult(resultRes.data);
          if (parsed.success) return parsed;
          // If parseResult returned no URL, the data may be nested under output
          const nested = resultRes.data?.output ?? resultRes.data?.result;
          if (nested) {
            const nestedParsed = parseResult(nested);
            if (nestedParsed.success) return nestedParsed;
          }
          console.error(`[fal] parseResult failed. raw:`, JSON.stringify(resultRes.data).slice(0, 400));
          return { success: false, error: `FAL completed but result format unknown: ${JSON.stringify(resultRes.data).slice(0, 200)}`, requestId };
        } catch (resultErr) {
          const msg = resultErr instanceof Error ? resultErr.message : String(resultErr);
          const rawDetail = axios.isAxiosError(resultErr) && resultErr.response
            ? JSON.stringify(resultErr.response.data ?? "").slice(0, 200)
            : "";
          console.error(`[fal] result fetch failed:`, msg, rawDetail);
          // Kling-specific: "Path /vX.X/standard not found" means the FAL account lacks Kling access/credits
          if (endpoint.includes("kling-video") && (rawDetail.includes("not found") || msg.includes("404"))) {
            return {
              success: false,
              error: "Kling is not available on this FAL account — check your FAL dashboard for Kling credits. Use Seedance 2.0 (MuAPI) or Hailuo instead.",
              requestId,
            };
          }
          return { success: false, error: `FAL result fetch failed: ${msg}`, requestId };
        }
      }
    }

    return { success: false, error: "FAL generation timed out — try a faster model (AID button)", requestId };
  } catch (err) {
    const msg = axios.isAxiosError(err) && err.response
      ? `FAL ${err.response.status}: ${JSON.stringify(err.response.data?.detail ?? err.response.data?.message ?? err.message).slice(0, 200)}`
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
  if (req.face_image_url) {
    input.face_image_url = req.face_image_url;
    // PuLID identity strength tuning — defaults of id_weight=1.0 + start_step=4 lock
    // the entire portrait state (face, body, pose, clothing) into every scene.
    // Lower id_weight + later start_step lets the scene prompt (action, clothing,
    // location) win while keeping face consistency.
    if (req.endpoint.includes("flux-pulid")) {
      input.id_weight = 0.75;     // default 1.0 — 0.75 = face stays, body/clothes free
      input.start_step = 6;       // default 4 — apply identity later, prompt sets composition first
      input.true_cfg = 1.0;       // default 1.0 — keep
    }
  }

  console.log(`[fal] Image: ${req.endpoint}`);
  return submitAndPoll(req.endpoint, input);
}

export async function falGenerateVideo(req: FalVideoRequest, onProgress?: FalProgressCallback): Promise<FalResponse> {
  const input: Record<string, unknown> = {
    prompt: req.prompt,
  };
  if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
  if (req.imageUrl) input.image_url = req.imageUrl;
  if (req.seed) input.seed = req.seed;

  // Kling models require duration as STRING ("5" or "10") and aspect_ratio
  const isKling = req.endpoint.includes("kling-video");
  if (isKling) {
    const dur = Math.round(Number(req.duration) || 5);
    input.duration = String(dur <= 5 ? 5 : 10);   // Kling only accepts "5" or "10"
    input.aspect_ratio = "16:9";
  } else if (req.duration) {
    input.duration = req.duration;
  }

  console.log(`[fal] Video: ${req.endpoint} (queue mode) duration=${input.duration}`);
  return submitAndPoll(req.endpoint, input, true, onProgress);
}

export async function downloadFalMedia(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
  return Buffer.from(res.data);
}

// Upload a local image buffer to a public CDN so external APIs (FAL, MuAPI, Runway) can access it.
// Uses the FAL two-step upload (initiate → PUT), falls back to Imgur.
export async function uploadImageToFal(imageBuffer: Buffer, mimeType = "image/jpeg"): Promise<string> {
  // ── Attempt 1: FAL Storage (two-step: initiate → PUT) ────────────────────
  try {
    // Step 1: Initiate — get signed upload_url + permanent file_url
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const fileName = `upload_${Date.now()}.${ext}`;
    const initiateRes = await axios.post(
      "https://rest.fal.ai/storage/upload/initiate",
      { file_name: fileName, content_type: mimeType },
      { headers: authHeaders(), timeout: 15000 },
    );
    const uploadUrl: string | undefined = initiateRes.data?.upload_url;
    const fileUrl: string | undefined = initiateRes.data?.file_url;
    if (uploadUrl && fileUrl) {
      // Step 2: PUT raw bytes to signed URL (no auth header needed — signed URL)
      await axios.put(uploadUrl, imageBuffer, {
        headers: { "Content-Type": mimeType },
        maxBodyLength: Infinity,
        timeout: 30000,
      });
      console.log(`[fal] Image uploaded to FAL Storage: ${fileUrl}`);
      return fileUrl;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[fal] FAL Storage upload failed (${msg}) — falling back to Imgur`);
  }

  // ── Attempt 2: Imgur anonymous upload ─────────────────────────────────────
  const imgurRes = await axios.post(
    "https://api.imgur.com/3/image",
    imageBuffer,
    {
      headers: {
        Authorization: "Client-ID 546c25a59c58ad7",
        "Content-Type": mimeType,
      },
      maxBodyLength: Infinity,
      timeout: 30000,
    },
  );
  const imgurUrl = imgurRes.data?.data?.link;
  if (!imgurUrl) {
    throw new Error(`Image upload failed: Imgur returned no URL. Data: ${JSON.stringify(imgurRes.data).slice(0, 200)}`);
  }
  console.log(`[fal] Image uploaded to Imgur CDN: ${imgurUrl}`);
  return imgurUrl as string;
}

export async function isFalConfigured(): Promise<boolean> {
  return !!process.env.FAL_KEY;
}

// ── Gemini Flash TTS — "GHS Voice Pro" ────────────────���──────────────────────
// Single-speaker and multi-speaker audio generation via fal.ai
// Uses existing FAL_KEY — no new account needed.

export interface GeminiTTSSpeaker {
  name: string;    // character name e.g. "Bear"
  text: string;    // what they say
  voice?: string;  // optional voice hint
}

export interface GeminiTTSResult {
  audioUrl: string;
  contentType: string;
}

export async function generateSpeechGemini(
  text: string,
  options: {
    voice?: string;
    language?: string;
    speakers?: GeminiTTSSpeaker[];
  } = {}
): Promise<GeminiTTSResult> {
  const key = getKey();

  if (options.speakers && options.speakers.length > 1) {
    // Multi-speaker mode: one call for all characters
    const multiText = options.speakers
      .map(s => `[${s.name}]: ${s.text}`)
      .join("\n");

    const res = await axios.post(
      `${SYNC_URL}/fal-ai/gemini-flash-tts`,
      {
        text: multiText,
        multi_speaker_mode: true,
        language: options.language || "en",
      },
      { headers: authHeaders(), timeout: 60000 }
    );

    const audioUrl = res.data?.audio?.url || res.data?.audio_url;
    if (!audioUrl) throw new Error(`Gemini TTS multi-speaker: no audio URL returned. ${JSON.stringify(res.data).slice(0, 200)}`);
    return { audioUrl, contentType: "audio/mp3" };
  }

  // Single-speaker mode
  const res = await axios.post(
    `${SYNC_URL}/fal-ai/gemini-flash-tts`,
    {
      text,
      voice: options.voice || "Charon",
      language: options.language || "en",
    },
    { headers: authHeaders(), timeout: 60000 }
  );

  const audioUrl = res.data?.audio?.url || res.data?.audio_url;
  if (!audioUrl) throw new Error(`Gemini TTS: no audio URL returned. ${JSON.stringify(res.data).slice(0, 200)}`);
  return { audioUrl, contentType: "audio/mp3" };
}

// ── Ideogram V3 Transparent Background ──────────────────────��────────────────
// Generates images with fully transparent PNG background.
// Output is always PNG with alpha channel — no background removal step needed.

export interface TransparentImageResult {
  imageUrl: string;
  fileName: string;
  seed?: number;
}

export async function generateTransparent(
  prompt: string,
  options: {
    image_size?: string;
    rendering_speed?: "BALANCED" | "QUALITY" | "SPEED";
    magic_prompt?: "AUTO" | "ON" | "OFF";
    seed?: number;
  } = {}
): Promise<TransparentImageResult> {
  const res = await axios.post(
    `${SYNC_URL}/fal-ai/ideogram/v3/generate-transparent`,
    {
      prompt,
      image_size: options.image_size || "square_hd",
      rendering_speed: options.rendering_speed || "BALANCED",
      magic_prompt_option: options.magic_prompt || "AUTO",
      seed: options.seed,
    },
    { headers: authHeaders(), timeout: 120000 }
  );

  const img = res.data?.images?.[0];
  if (!img?.url) throw new Error(`Ideogram Transparent: no image URL. ${JSON.stringify(res.data).slice(0, 200)}`);
  return { imageUrl: img.url, fileName: img.file_name || "transparent.png", seed: res.data?.seed };
}

// ── Ideogram V3 Layerize Text ──────────────────────────────���──────────────────
// Takes a flat image and extracts text as editable JSON + overlay HTML.

export interface LayerizeTextResult {
  backgroundUrl: string;         // image with all text removed
  textContainers: LayerizeContainer[];
  overlayHtml: string;           // HTML to recomposite text over background
  imageLayers: unknown[];
  seed?: number;
}

export interface LayerizeContainer {
  container: { x: number; y: number; width: number; height: number };
  items: Array<{
    spans: Array<{
      text: string;
      style: string;       // "h1" | "h2" | "body" | "small"
      font_size: number;
      color: string;
    }>;
  }>;
}

export async function layerizeText(
  imageUrl: string,
  options: { prompt?: string; seed?: number } = {}
): Promise<LayerizeTextResult> {
  const res = await axios.post(
    `${SYNC_URL}/fal-ai/ideogram/v3/layerize-text`,
    {
      image_url: imageUrl,
      prompt: options.prompt || "",
      seed: options.seed,
    },
    { headers: authHeaders(), timeout: 120000 }
  );

  const d = res.data;
  if (!d?.image?.url) throw new Error(`Layerize: no background URL. ${JSON.stringify(d).slice(0, 200)}`);

  return {
    backgroundUrl: d.image.url,
    textContainers: d.text_containers || [],
    overlayHtml: d.overlay_html || "",
    imageLayers: d.image_layers || [],
    seed: d.seed,
  };
}
