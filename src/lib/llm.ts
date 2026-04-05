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
  maxTokens?: number;     // default 400
  temperature?: number;   // default 0.4
  timeoutMs?: number;     // default 20000
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
    const msg = await client.messages.create({
      model: CLAUDE_MODELS[speed],
      max_tokens: opts.maxTokens ?? 400,
      system: system ?? "You are a helpful assistant.",
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string })?.text?.trim() ?? "";
    if (!text) return { ok: false, error: "Claude returned empty response" };
    return { ok: true, text, provider: `claude/${CLAUDE_MODELS[speed]}` };
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
    const res = await client.chat.completions.create({
      model: GPT_MODELS[speed],
      max_tokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0.4,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "GPT returned empty response" };
    return { ok: true, text, provider: `openai/${GPT_MODELS[speed]}` };
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
    const res = await client.chat.completions.create({
      model: GROK_MODELS[speed],
      max_tokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0.4,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: prompt },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "Grok returned empty response" };
    return { ok: true, text, provider: `grok/${GROK_MODELS[speed]}` };
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
        options: { temperature: opts.temperature ?? 0.4, num_predict: opts.maxTokens ?? 400 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
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

// ── Main router — tries providers in priority order ──────────

export async function callLLM(
  prompt: string,
  system?: string,
  opts: LLMOptions = {}
): Promise<LLMResult> {
  // Resolve role and speed once — passed into each provider caller
  const role: LLMRole = opts.role ?? (opts.speed === "quality" ? "quality" : "fast");
  const speed: LLMSpeed = roleToSpeed(role);

  // Check forced provider first — avoids building the providers array unnecessarily
  const forced = loadLLMSettings().LLM_PROVIDER?.toLowerCase();
  if (forced === "claude")                     return callClaude(prompt, system, speed, opts);
  if (forced === "openai" || forced === "gpt") return callGPT(prompt, system, speed, opts);
  if (forced === "grok" || forced === "xai")   return callGrok(prompt, system, speed, opts);
  if (forced === "ollama")                     return callOllama(prompt, system, role, opts);

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
