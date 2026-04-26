// GioHomeStudio — Multi-Provider LLM Router
//
// Priority chain (first key that is set wins):
//   1. Claude (Anthropic API)  — claude-haiku-4-5  fast/cheap · claude-sonnet-4-6 quality
//   2. GPT (OpenAI API)        — gpt-4o-mini fast · gpt-4o quality
//   3. Grok (xAI API)          — grok-3-mini fast · grok-3 quality
//   4. Ollama (local)          — role-based model from settings
//   5. Rule-based fallback     — no LLM, returns empty so caller uses its own fallback
//
// Notes on Claude Code / Claude subscription:
//   - The Claude.ai subscription (Pro/Max/Teams) gives web access but NOT API access.
//   - API access requires a separate key from console.anthropic.com.
//   - However if you run Claude Code with --api-key, that same key works here.
//   - Set ANTHROPIC_API_KEY in .env — this is the recommended primary LLM.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { loadLLMSettings, getLLMSettingsStatus } from "@/lib/llm-settings";
import { kieCallLLM } from "@/lib/generation/gateways/kie";

// ── Provider models ───────────────────────────────────────────
export type LLMSpeed = "fast" | "quality";

// LLMRole maps to specific Ollama models via settings.
// Cloud providers map role → speed (supervisor/quality → "quality", others → "fast").
export type LLMRole = "fast" | "quality" | "creative" | "assistant" | "supervisor";

const CLAUDE_MODELS: Record<LLMSpeed, string> = {
  fast:    "claude-haiku-4-5-20251001",
  quality: "claude-sonnet-4-6",
};

const GPT_MODELS: Record<LLMSpeed, string> = {
  fast:    "gpt-4o-mini",
  quality: "gpt-4o",
};

const GROK_MODELS: Record<LLMSpeed, string> = {
  fast:    "grok-3-mini",
  quality: "grok-3",
};

// All selectable models shown in the Story AI picker
export const SELECTABLE_MODELS = [
  // Auto
  { value: "auto",                    label: "Auto — best available",              provider: "auto"   },
  // Claude
  { value: "claude:claude-opus-4-6",  label: "Claude Opus 4.6 — most powerful",   provider: "claude" },
  { value: "claude:claude-sonnet-4-6",label: "Claude Sonnet 4.6 — recommended ✓", provider: "claude" },
  { value: "claude:claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast/cheap", provider: "claude" },
  // OpenAI
  { value: "openai:gpt-4o",           label: "GPT-4o — OpenAI best",              provider: "openai" },
  { value: "openai:o3-mini",          label: "o3-mini — OpenAI reasoning",         provider: "openai" },
  { value: "openai:gpt-4o-mini",      label: "GPT-4o mini — fast",                provider: "openai" },
  // Grok
  { value: "grok:grok-3",             label: "Grok 3 — xAI best (needs key)",     provider: "grok"   },
  { value: "grok:grok-3-mini",        label: "Grok 3 mini — fast (needs key)",    provider: "grok"   },
  // Ollama
  { value: "ollama",                  label: "Ollama — local (no cost)",           provider: "ollama" },
  // Kie / DeepSeek
  { value: "kie:deepseek-r1",         label: "DeepSeek R1 — reasoning (Kie)",     provider: "kie"    },
  { value: "kie:deepseek-v3",         label: "DeepSeek V3 — general (Kie)",       provider: "kie"    },
] as const;

/** Resolve the Ollama model name for a given role from saved settings. */
function getOllamaModel(role: LLMRole): string {
  const s = loadLLMSettings();
  switch (role) {
    case "supervisor": return s.OLLAMA_MODEL_SUPERVISOR ?? "qwen2.5:14b";
    case "quality":    return s.OLLAMA_MODEL_QUALITY    ?? "qwen2.5:14b";
    case "creative":   return s.OLLAMA_MODEL_CREATIVE   ?? "mistral:latest";
    case "assistant":  return s.OLLAMA_MODEL_ASSISTANT  ?? "llama3:latest";
    case "fast":
    default:           return s.OLLAMA_MODEL_FAST       ?? "phi3:latest";
  }
}

/** Map a role to the cloud provider speed tier. */
function roleToSpeed(role: LLMRole): LLMSpeed {
  return role === "supervisor" || role === "quality" ? "quality" : "fast";
}

// ── Result types ──────────────────────────────────────────────
export interface LLMSuccess { ok: true;  text: string; provider: string; }
export interface LLMFailure { ok: false; error: string; }
export type LLMResult = LLMSuccess | LLMFailure;

export interface LLMOptions {
  speed?: LLMSpeed;       // "fast" (default) or "quality" — used by cloud providers; ignored when role is set
  role?:  LLMRole;        // role-based routing — picks Ollama model and maps to cloud speed
  maxTokens?: number;     // default 1200
  temperature?: number;   // default 0.4
  timeoutMs?: number;     // default 20000
  forceProvider?: "claude" | "openai" | "gpt" | "grok" | "ollama" | "kie" | "deepseek"; // override auto-selection
  forceModel?: string;    // override specific model e.g. "claude-opus-4-6", "o3-mini"
}

// ── Per-provider callers ──────────────────────────────────────

async function callClaude(
  prompt: string,
  system: string | undefined,
  speed: LLMSpeed,
  opts: LLMOptions
): Promise<LLMResult> {
  const key = loadLLMSettings().ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  try {
    const client = new Anthropic({ apiKey: key });
    const model = opts.forceModel || CLAUDE_MODELS[speed];
    const msg = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1200,
      system: system ?? "You are a helpful assistant.",
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string })?.text?.trim() ?? "";
    if (!text) return { ok: false, error: "Claude returned empty response" };
    return { ok: true, text, provider: `claude/${model}` };
  } catch (err) {
    return { ok: false, error: `Claude error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function callGPT(
  prompt: string,
  system: string | undefined,
  speed: LLMSpeed,
  opts: LLMOptions
): Promise<LLMResult> {
  const key = loadLLMSettings().OPENAI_API_KEY;
  if (!key) return { ok: false, error: "OPENAI_API_KEY not set" };

  try {
    const client = new OpenAI({ apiKey: key });
    const model = opts.forceModel || GPT_MODELS[speed];
    // o1/o3 reasoning models: use max_completion_tokens, no temperature, no system role
    const isReasoningModel = model.startsWith("o1") || model.startsWith("o3");
    const res = await client.chat.completions.create({
      model,
      // Reasoning models require max_completion_tokens; standard models use max_tokens
      ...(isReasoningModel
        ? { max_completion_tokens: opts.maxTokens ?? 1200 }
        : { max_tokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.4 }
      ),
      messages: [
        ...(!isReasoningModel && system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: isReasoningModel && system ? `${system}\n\n${prompt}` : prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "GPT returned empty response" };
    return { ok: true, text, provider: `openai/${model}` };
  } catch (err) {
    return { ok: false, error: `GPT error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function callGrok(
  prompt: string,
  system: string | undefined,
  speed: LLMSpeed,
  opts: LLMOptions
): Promise<LLMResult> {
  const key = loadLLMSettings().XAI_API_KEY;
  if (!key) return { ok: false, error: "XAI_API_KEY not set" };

  try {
    // xAI Grok uses OpenAI-compatible API
    const client = new OpenAI({
      apiKey: key,
      baseURL: "https://api.x.ai/v1",
    });
    const model = opts.forceModel || GROK_MODELS[speed];
    const res = await client.chat.completions.create({
      model,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.4,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "Grok returned empty response" };
    return { ok: true, text, provider: `grok/${model}` };
  } catch (err) {
    return { ok: false, error: `Grok error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function callOllama(
  prompt: string,
  system: string | undefined,
  role: LLMRole,
  opts: LLMOptions
): Promise<LLMResult> {
  const settings = loadLLMSettings();
  const ollamaBase = settings.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = getOllamaModel(role);

  // Fast reachability probe — 1.5s max. If Ollama isn't running, fail immediately
  // so the router can move on to the next provider without a long delay.
  try {
    await fetch(`${ollamaBase}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    return { ok: false, error: "Ollama: not reachable (not running locally)" };
  }

  // Ollama IS running — cap generation at 15s so slow local models don't block the fallback chain.
  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        stream: false,
        keep_alive: "10m",
        options: { temperature: opts.temperature ?? 0.4, num_predict: opts.maxTokens ?? 1200 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    });
    if (!res.ok) return { ok: false, error: `Ollama HTTP ${res.status}` };
    const data = await res.json();
    const text = (data?.message?.content ?? data?.response ?? "").trim();
    if (!text) return { ok: false, error: "Ollama returned empty response" };
    return { ok: true, text, provider: `ollama/${model}` };
  } catch (err) {
    return { ok: false, error: `Ollama: ${err instanceof Error ? err.message : "unreachable"}` };
  }
}

async function callKieDeepSeek(
  prompt: string,
  system: string | undefined,
  model: "deepseek-r1" | "deepseek-v3",
  opts: LLMOptions
): Promise<LLMResult> {
  const key = process.env.KIE_API_KEY || process.env.KIE_AI_API_KEY;
  if (!key) return { ok: false, error: "KIE_API_KEY not set" };
  const result = await kieCallLLM({ model, prompt, system, maxTokens: opts.maxTokens ?? 1200, temperature: opts.temperature ?? 0.4 });
  if (!result.ok) return { ok: false, error: result.error ?? "Kie LLM failed" };
  return { ok: true, text: result.text!, provider: result.provider! };
}

// ── Main router — tries providers in priority order ──────────

export async function callLLM(
  prompt: string,
  system?: string,
  opts: LLMOptions = {}
): Promise<LLMResult> {
  // Resolve role and speed once — passed into each provider caller
  const role: LLMRole = opts.role ?? (opts.speed === "quality" ? "quality" : "fast");
  const speed: LLMSpeed = roleToSpeed(role);

  // Check per-call forced provider first (opts.forceProvider), then global LLM_PROVIDER setting
  const forced = opts.forceProvider?.toLowerCase() || loadLLMSettings().LLM_PROVIDER?.toLowerCase();
  if (forced === "claude")                     return callClaude(prompt, system, speed, opts);
  if (forced === "openai" || forced === "gpt") return callGPT(prompt, system, speed, opts);
  if (forced === "grok" || forced === "xai")   return callGrok(prompt, system, speed, opts);
  if (forced === "ollama")                     return callOllama(prompt, system, role, opts);
  if (forced === "kie" || forced === "deepseek") {
    const m = opts.forceModel === "deepseek-r1" ? "deepseek-r1" : "deepseek-v3";
    return callKieDeepSeek(prompt, system, m, opts);
  }

  const providers: Array<() => Promise<LLMResult>> = [
    () => callClaude(prompt, system, speed, opts),
    () => callGPT(prompt, system, speed, opts),
    () => callGrok(prompt, system, speed, opts),
    () => callOllama(prompt, system, role, opts),
  ];

  const errors: string[] = [];
  for (const fn of providers) {
    const result = await fn();
    if (result.ok) return result;
    errors.push(result.error);
  }

  return {
    ok: false,
    error: `All LLM providers failed: ${errors.join(" | ")}`,
  };
}

// ── Convenience: check which providers are available ─────────
export function getLLMProviderStatus(): Record<string, "configured" | "not_configured"> {
  return getLLMSettingsStatus();
}

// ── Re-export Ollama caller for backward compat ───────────────
// Existing callers that import callOllama directly keep working.
export { callOllama as callOllamaOnly };

// ── GHS AI Tier routing ───────────────────────────────────────
// Maps user-visible tiers (GHS Free / Standard / Pro) to real models.
// Use this in API routes that accept a `tier` param.
export type GHSTier = "free" | "standard" | "pro";

export async function callLLMTier(
  prompt: string,
  tier: GHSTier = "standard",
  systemPrompt?: string,
): Promise<string> {
  let result: LLMResult;

  if (tier === "free") {
    // Free → Ollama first, fallback to standard if Ollama is down
    result = await callLLM(prompt, systemPrompt, { forceProvider: "ollama" });
    if (result.ok) return result.text;
    // Ollama failed → fall through to standard
    result = await callLLM(prompt, systemPrompt, { speed: "fast" });
  } else if (tier === "pro") {
    result = await callLLM(prompt, systemPrompt, { speed: "quality" });
  } else {
    result = await callLLM(prompt, systemPrompt, { speed: "fast" });
  }

  if (result.ok) return result.text;
  throw new Error(result.error);
}
