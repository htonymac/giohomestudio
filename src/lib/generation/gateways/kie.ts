// GioHomeStudio — Kie.ai Gateway
// Covers image generation AND LLM (DeepSeek) via a single API key.
// Auth: Bearer token from KIE_API_KEY env var.
// Base URL: https://api.kie.ai
//
// Credit notes:
//   - 300 general credits on free signup (image + other models)
//   - 5,000 DeepSeek credits (separate pool)
//   - Credit balance returned in X-Credits-Remaining header when available
//
// Supported image models:
//   z-image-turbo     budget photorealistic, cheapest
//   nano-banana-2     premium image, ~$0.04/image
//   gpt-image-1       OpenAI image model proxied, $0.02-$0.19 depending on quality
//   flux-kontext      image editing / style transfer
//   midjourney-v7     premium aesthetic tier
//
// Supported LLM models (DeepSeek pool):
//   deepseek-r1       reasoning tier
//   deepseek-v3       general NLP tier

import * as fs from "fs";
import * as path from "path";

const KIE_BASE = "https://api.kie.ai";

function getKey(): string {
  const key = process.env.KIE_API_KEY || process.env.KIE_AI_API_KEY;
  if (!key) throw new Error("KIE_API_KEY not set");
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getKey()}`,
    "Content-Type": "application/json",
  };
}

// ── Credit balance logging ────────────────────────────────────────────────────

function logCreditBalance(res: Response, model: string): void {
  const remaining = res.headers.get("X-Credits-Remaining") ??
                    res.headers.get("x-credits-remaining") ??
                    res.headers.get("x-remaining-credits");
  if (remaining !== null) {
    console.log(`[Kie] ${model} — credits remaining: ${remaining}`);
  }
}

// ── Image generation ──────────────────────────────────────────────────────────

export interface KieImageRequest {
  endpoint_id: string;    // z-image-turbo | nano-banana-2 | gpt-image-1 | flux-kontext | midjourney-v7
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  quality?: "low" | "medium" | "high"; // for gpt-image-1 only
  steps?: number;
}

export interface KieImageResponse {
  success: boolean;
  data?: Buffer;
  imageUrl?: string;
  creditsUsed?: number;
  error?: string;
}

export async function kieGenerateImage(req: KieImageRequest): Promise<KieImageResponse> {
  const { endpoint_id, prompt, negativePrompt, width = 1024, height = 1024, seed, quality, steps } = req;

  const body: Record<string, unknown> = {
    model: endpoint_id,
    prompt,
    width,
    height,
  };
  if (negativePrompt)  body.negative_prompt = negativePrompt;
  if (seed !== undefined) body.seed = seed;
  if (quality)         body.quality = quality;
  if (steps)           body.steps = steps;

  try {
    const res = await fetch(`${KIE_BASE}/api/v1/images/generations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    logCreditBalance(res, endpoint_id);

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { success: false, error: `Kie image ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();

    // Kie may return a URL or base64 depending on model
    const imageUrl: string | undefined =
      data?.data?.[0]?.url ??
      data?.images?.[0]?.url ??
      data?.url ??
      data?.image_url;

    const base64: string | undefined =
      data?.data?.[0]?.b64_json ??
      data?.b64_json;

    if (imageUrl) {
      // Download the image so the caller can save it locally
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
      if (!imgRes.ok) return { success: false, error: `Kie: failed to download image (${imgRes.status})` };
      const buf = Buffer.from(await imgRes.arrayBuffer());
      return { success: true, data: buf, imageUrl, creditsUsed: data?.credits_used };
    }

    if (base64) {
      return { success: true, data: Buffer.from(base64, "base64"), creditsUsed: data?.credits_used };
    }

    return { success: false, error: `Kie: no image URL or base64 in response — ${JSON.stringify(data).slice(0, 200)}` };
  } catch (err) {
    return { success: false, error: `Kie gateway error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── LLM (DeepSeek via Kie) ──────────────────────────────────────────────────

export interface KieLLMRequest {
  model: "deepseek-r1" | "deepseek-v3";
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface KieLLMResponse {
  ok: boolean;
  text?: string;
  provider?: string;
  error?: string;
}

export async function kieCallLLM(req: KieLLMRequest): Promise<KieLLMResponse> {
  const { model, prompt, system, maxTokens = 1200, temperature = 0.4 } = req;

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  try {
    const res = await fetch(`${KIE_BASE}/api/v1/chat/completions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      signal: AbortSignal.timeout(60_000),
    });

    logCreditBalance(res, model);

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { ok: false, error: `Kie LLM ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "Kie LLM returned empty response" };

    return { ok: true, text, provider: `kie/${model}` };
  } catch (err) {
    return { ok: false, error: `Kie LLM error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── Account / balance check ───────────────────────────────────────────────────

export async function kieGetBalance(): Promise<{ credits: number | null; deepseekCredits: number | null; error?: string }> {
  try {
    const res = await fetch(`${KIE_BASE}/api/v1/account/balance`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Try alternate endpoint
      const res2 = await fetch(`${KIE_BASE}/api/v1/user/credits`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res2.ok) return { credits: null, deepseekCredits: null, error: `HTTP ${res.status}` };
      const d2 = await res2.json();
      return {
        credits: d2?.credits ?? d2?.balance ?? null,
        deepseekCredits: d2?.deepseek_credits ?? null,
      };
    }
    const d = await res.json();
    return {
      credits: d?.credits ?? d?.balance ?? d?.general_credits ?? null,
      deepseekCredits: d?.deepseek_credits ?? null,
    };
  } catch (err) {
    return { credits: null, deepseekCredits: null, error: err instanceof Error ? err.message : String(err) };
  }
}
