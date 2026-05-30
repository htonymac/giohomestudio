// FAL provider adapter — single chokepoint for every fal.run / queue.fal.run call.
//
// Henry's session-original ask (2026-05-30): 24+ routes currently call fal directly.
// When fal changes their endpoint shape or auth, you have 24 files to fix. After this
// adapter is wired everywhere, you have one. Same pattern the existing src/lib/llm.ts
// already gives us for Claude / OpenAI / Ollama.
//
// Scope of this commit: scaffold + 3 representative migrations (image gen, TTS narrator,
// account status). Remaining 17+ sites stay on their existing direct-fetch path and
// migrate incrementally via `go fal migrate <route>` triggers.
//
// IMPORTANT: every function here soft-fails to a typed `Result<T>` shape — never throws
// out into route code. Routes get a uniform `{ ok, data | error, status, raw }` so they
// stop reimplementing error handling.

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || "";
const FAL_BASE = process.env.FAL_BASE_URL || "https://fal.run";
const FAL_QUEUE_BASE = "https://queue.fal.run";
const FAL_REST = "https://rest.fal.ai";

export type FalResult<T> =
  | { ok: true;  data: T;     status: number; raw: unknown }
  | { ok: false; error: string; status: number; raw?: unknown };

interface FalCallOpts {
  base?: "sync" | "queue" | "rest";   // which host
  timeoutMs?: number;                 // default 60000
  signal?: AbortSignal;
}

/**
 * One-shot synchronous-style FAL call: `POST {base}/{endpoint}` → JSON.
 * Catches network/auth/decode errors and folds them into FalResult.
 */
export async function falCall<T = unknown>(
  endpoint: string,
  body: unknown,
  opts: FalCallOpts = {},
): Promise<FalResult<T>> {
  if (!FAL_KEY) return { ok: false, error: "FAL_KEY not configured", status: 0 };

  const base = opts.base === "queue" ? FAL_QUEUE_BASE
             : opts.base === "rest"  ? FAL_REST
             : FAL_BASE;
  const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  // Combine caller signal + our timeout
  const signal = opts.signal
    ? (AbortSignal.any ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal)
    : ctrl.signal;

  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    let raw: unknown = null;
    try { raw = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const errMsg = (raw && typeof raw === "object" && "detail" in raw)
        ? String((raw as { detail: unknown }).detail).slice(0, 400)
        : `FAL ${res.status} ${res.statusText}`;
      return { ok: false, error: errMsg, status: res.status, raw };
    }
    return { ok: true, data: raw as T, status: res.status, raw };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort/i.test(msg)) return { ok: false, error: "FAL request aborted (timeout)", status: 0 };
    return { ok: false, error: msg, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Queue-mode FAL call: POST + poll status/result. Use for slow models (FLUX dev/pro,
 * Wan video, lip-sync). Times out after `opts.timeoutMs` (default 120s) total.
 */
export async function falQueue<T = unknown>(
  endpoint: string,
  body: unknown,
  opts: FalCallOpts = {},
): Promise<FalResult<T>> {
  const submitRes = await falCall<{ request_id?: string }>(endpoint, body, { ...opts, base: "queue" });
  if (!submitRes.ok) return submitRes;
  const reqId = submitRes.data?.request_id;
  if (!reqId) return { ok: false, error: "FAL queue: no request_id in submit response", status: submitRes.status, raw: submitRes.raw };

  const deadline = Date.now() + (opts.timeoutMs ?? 120_000);
  const statusUrl = `${FAL_QUEUE_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}/requests/${reqId}/status`;
  const resultUrl = `${FAL_QUEUE_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}/requests/${reqId}`;
  // Poll every 1500ms
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500));
    const statusRes = await falCall<{ status: string }>(statusUrl, undefined);
    if (!statusRes.ok) return statusRes;
    const status = statusRes.data?.status?.toUpperCase?.() || "";
    if (status === "COMPLETED") {
      const result = await falCall<T>(resultUrl, undefined);
      return result;
    }
    if (status === "FAILED" || status === "ERROR") {
      return { ok: false, error: `FAL queue ${endpoint}: ${status}`, status: statusRes.status, raw: statusRes.raw };
    }
  }
  return { ok: false, error: "FAL queue: total timeout exceeded", status: 0 };
}

// ── Typed helpers — common shapes for the most-used endpoints ───────────────

export interface FalImageRequest {
  prompt: string;
  negativePrompt?: string;
  imageSize?: { width: number; height: number } | string;  // some models take "landscape_16_9" strings
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
  // Optional model override — defaults below per function.
}

export interface FalImageResponse {
  images?: Array<{ url: string; width?: number; height?: number }>;
  seed?: number;
  has_nsfw_concepts?: boolean[];
}

/**
 * FLUX schnell — fastest + cheapest text-to-image. Use as default for previews.
 */
export function falFluxSchnell(req: FalImageRequest): Promise<FalResult<FalImageResponse>> {
  return falCall<FalImageResponse>("/fal-ai/flux/schnell", {
    prompt: req.prompt,
    negative_prompt: req.negativePrompt,
    image_size: req.imageSize ?? "square_hd",
    num_inference_steps: req.numInferenceSteps ?? 4,
    guidance_scale: req.guidanceScale ?? 3.5,
    seed: req.seed,
  });
}

/**
 * FLUX dev — higher quality, slower. Use queue for production renders.
 */
export function falFluxDev(req: FalImageRequest): Promise<FalResult<FalImageResponse>> {
  return falQueue<FalImageResponse>("/fal-ai/flux/dev", {
    prompt: req.prompt,
    negative_prompt: req.negativePrompt,
    image_size: req.imageSize ?? "landscape_16_9",
    num_inference_steps: req.numInferenceSteps ?? 28,
    guidance_scale: req.guidanceScale ?? 3.5,
    seed: req.seed,
  });
}

export interface FalKokoroTtsRequest {
  prompt: string;
  voice?: string;                  // af_bella, am_adam, am_michael, etc.
  speed?: number;                  // 0.5 - 2.0
  variant?: "american-english" | "global";  // default american
}

export interface FalKokoroTtsResponse {
  audio?: { url: string; content_type?: string };
}

/**
 * Kokoro TTS — narrator + character voice. Used by /api/tts, /api/avatar/create,
 * /api/hybrid/narrate-piper, /api/tts/fal-narrator.
 */
export function falKokoroTts(req: FalKokoroTtsRequest): Promise<FalResult<FalKokoroTtsResponse>> {
  const path = req.variant === "global" ? "/fal-ai/kokoro" : "/fal-ai/kokoro/american-english";
  return falCall<FalKokoroTtsResponse>(path, {
    prompt: req.prompt,
    voice: req.voice ?? "af_bella",
    speed: req.speed ?? 1.0,
  });
}

/**
 * Account introspection — used by /api/account/status to read FAL balance/quotas.
 */
export function falAccountStatus(): Promise<FalResult<unknown>> {
  return falCall<unknown>("/v1/me", undefined, { base: "rest" });
}

// ── Background removal helpers ──────────────────────────────────────────────
// The 3 bg-remove routes (ad-editor/bg-remove, image/bg-remove, video/bg-remove)
// previously hit fal endpoints directly with a single POST and read the image URL
// out of the response — no queue polling. Preserving that pattern via the queue
// base URL so behavior is identical to the pre-adapter code.

export interface FalBgRemoveResponse {
  image?: { url: string; content_type?: string };
  video?: { url: string; content_type?: string };
}

export type FalBgRemoveModel = "birefnet" | "bria-rmbg" | "birefnet-video" | "video-bg-remove";

const BG_REMOVE_PATH: Record<FalBgRemoveModel, string> = {
  "birefnet":         "/fal-ai/birefnet",
  "bria-rmbg":        "/fal-ai/bria-rmbg",
  "birefnet-video":   "/fal-ai/birefnet/video",
  "video-bg-remove":  "/fal-ai/video-background-removal",
};

export function falBgRemove(
  model: FalBgRemoveModel,
  body: { image_url?: string; video_url?: string },
): Promise<FalResult<FalBgRemoveResponse>> {
  return falCall<FalBgRemoveResponse>(BG_REMOVE_PATH[model], body, { base: "queue", timeoutMs: 90_000 });
}

// ── FLUX dev (sync variant) — auto-portraits route hits fal.run not queue.fal.run.
export function falFluxDevSync(req: FalImageRequest): Promise<FalResult<FalImageResponse>> {
  return falCall<FalImageResponse>("/fal-ai/flux/dev", {
    prompt: req.prompt,
    negative_prompt: req.negativePrompt,
    image_size: req.imageSize ?? "landscape_16_9",
    num_inference_steps: req.numInferenceSteps ?? 28,
    guidance_scale: req.guidanceScale ?? 3.5,
    seed: req.seed,
  }, { timeoutMs: 90_000 });
}

// ── Music: MiniMax Music v2 — used by /api/music/generate-scene.
export interface FalMinimaxMusicRequest {
  prompt: string;
  lyricsPrompt?: string;
  sampleRate?: number;
  bitrate?: number;
  format?: "mp3" | "wav";
}
export interface FalMinimaxMusicResponse {
  audio?: { url: string; content_type?: string };
}
export function falMinimaxMusic(req: FalMinimaxMusicRequest): Promise<FalResult<FalMinimaxMusicResponse>> {
  return falCall<FalMinimaxMusicResponse>("/fal-ai/minimax-music/v2", {
    prompt: req.prompt.slice(0, 300),
    lyrics_prompt: req.lyricsPrompt,
    audio_setting: {
      sample_rate: req.sampleRate ?? 44100,
      bitrate: req.bitrate ?? 128000,
      format: req.format ?? "mp3",
    },
  }, { timeoutMs: 120_000 });
}

// ── SFX: Stable Audio — used by /api/sfx/generate.
export interface FalStableAudioRequest {
  prompt: string;
  secondsTotal?: number;  // up to ~45s per FAL docs; SFX usually ≤10s
  steps?: number;
}
export interface FalStableAudioResponse {
  audio_file?: { url: string; content_type?: string };
  url?: string;
}
export function falStableAudio(req: FalStableAudioRequest): Promise<FalResult<FalStableAudioResponse>> {
  return falCall<FalStableAudioResponse>("/fal-ai/stable-audio", {
    prompt: req.prompt,
    seconds_total: req.secondsTotal ?? 10,
    steps: req.steps ?? 100,
  }, { timeoutMs: 45_000 });
}

// ── FLUX img2img (queue) — used by /api/ad-editor/ai-edit edit path
export interface FalFluxImg2ImgRequest {
  prompt: string;
  imageUrl: string;     // data URL or http URL
  strength?: number;    // 0..1
  numInferenceSteps?: number;
}
export function falFluxImg2Img(req: FalFluxImg2ImgRequest): Promise<FalResult<FalImageResponse>> {
  return falCall<FalImageResponse>("/fal-ai/flux/dev/image-to-image", {
    prompt: req.prompt,
    image_url: req.imageUrl,
    strength: req.strength ?? 0.65,
    num_inference_steps: req.numInferenceSteps ?? 28,
  }, { base: "queue", timeoutMs: 120_000 });
}

// ── Gemini Flash TTS (used by /api/ad-editor/gemini-tts)
export interface FalGeminiTtsRequest { text: string; voiceName?: string }
export interface FalGeminiTtsResponse { audio?: { url?: string; duration?: number }; audio_url?: string; duration?: number }
export function falGeminiTts(req: FalGeminiTtsRequest): Promise<FalResult<FalGeminiTtsResponse>> {
  return falCall<FalGeminiTtsResponse>("/fal-ai/gemini-3.1-flash-tts", {
    text: req.text,
    voice_name: req.voiceName ?? "alloy",
  });
}

// ── Ideogram v3 layerize-text (used by /api/ad-editor/layerize-text)
export function falLayerizeText<T = unknown>(body: Record<string, unknown>): Promise<FalResult<T>> {
  return falCall<T>("/fal-ai/ideogram/v3/layerize-text", body, { base: "queue", timeoutMs: 90_000 });
}

// ── Clarity Upscaler (used by /api/image/enhance)
export interface FalClarityUpscalerRequest {
  imageUrl: string;
  prompt?: string;
  scale?: number;
  creativity?: number;
  resemblance?: number;
}
export interface FalClarityUpscalerResponse { image?: { url?: string } }
export function falClarityUpscaler(req: FalClarityUpscalerRequest): Promise<FalResult<FalClarityUpscalerResponse>> {
  return falCall<FalClarityUpscalerResponse>("/fal-ai/clarity-upscaler", {
    image_url: req.imageUrl,
    prompt: req.prompt,
    scale: req.scale ?? 1,
    creativity: req.creativity ?? 0.2,
    resemblance: req.resemblance ?? 0.9,
  }, { base: "queue", timeoutMs: 120_000 });
}
