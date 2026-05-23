// Per-scene AI assistant — helps users improve image prompts and scene descriptions.
//
// Provider fallback chain (when provider is "auto" or omitted):
//   1. Ollama  (local, free, no key needed) — preferred
//   2. OpenAI  (GPT) — fallback if Ollama is offline
//   3. Claude  (Haiku) — fallback if GPT also fails
//
// User can also pass an explicit provider ("ollama" | "openai" | "claude") to skip the chain.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

type ChatProvider = "auto" | "ollama" | "openai" | "claude";

interface SceneChatRequest {
  sceneId: string;
  sceneTitle: string;
  sceneDescription: string;
  sceneLocation?: string;
  sceneMood?: string;
  characters?: string[];
  currentImagePrompt?: string;
  userMessage: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: ChatProvider;   // optional — defaults to "auto" (run full fallback chain)
}

function buildSystemPrompt(req: SceneChatRequest): string {
  const lines: string[] = [
    "You are a scene assistant for a video story production tool.",
    "Your job is to help the user improve their scene image prompts and scene descriptions.",
    "",
    "Current scene context:",
    `- Title: ${req.sceneTitle}`,
    `- Description: ${req.sceneDescription}`,
  ];

  if (req.sceneLocation) lines.push(`- Location: ${req.sceneLocation}`);
  if (req.sceneMood) lines.push(`- Mood: ${req.sceneMood}`);
  if (req.characters && req.characters.length > 0) {
    lines.push(`- Characters in scene: ${req.characters.join(", ")}`);
  }
  if (req.currentImagePrompt) {
    lines.push(`- Current image prompt: ${req.currentImagePrompt}`);
  }

  lines.push(
    "",
    "Common scene problems you help fix:",
    "- Wrong body language or pose for the emotion",
    "- Missing action or movement cues",
    "- Wrong emotional expression on characters",
    "- Vague or weak visual direction",
    "- Characters not positioned correctly in the scene",
    "",
    "How to respond:",
    "1. Understand what the user wants to fix or improve.",
    "2. Provide a corrected image generation prompt on its own line, starting exactly with: IMAGE PROMPT:",
    "3. Optionally suggest updated wording for the scene description.",
    "Keep your response focused and practical.",
  );

  return lines.join("\n");
}

function buildUserPrompt(req: SceneChatRequest): string {
  if (!req.history || req.history.length === 0) {
    return req.userMessage;
  }
  const turns = req.history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  return `${turns}\nUser: ${req.userMessage}`;
}

function extractImagePrompt(reply: string): string | undefined {
  const lines = reply.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("IMAGE PROMPT:")) {
      return trimmed.slice("IMAGE PROMPT:".length).trim() || undefined;
    }
  }
  return undefined;
}

/**
 * Try a provider chain in order. Returns the first successful result.
 * If a stage throws or returns ok=false we move on, collecting error messages
 * so the caller can see what failed when every provider is down.
 */
async function runWithFallback(
  prompt: string,
  system: string,
  chain: Array<"ollama" | "openai" | "claude">
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  // FIX 8 (2026-05-22): per-provider timeout. Without this, an unresponsive Ollama
  // (e.g. model still loading) caused every chat message to wait full default
  // timeout before falling through. Now each provider gets a fixed cap.
  const PROVIDER_TIMEOUT_MS: Record<string, number> = {
    ollama: 12000, // 12s — fast fail when local is sluggish
    openai: 30000,
    claude: 30000,
  };
  const errors: string[] = [];
  for (const provider of chain) {
    try {
      const result = await callLLM(prompt, system, {
        forceProvider: provider,
        role: provider === "claude" ? "fast" : "assistant",
        maxTokens: 800,
        timeoutMs: PROVIDER_TIMEOUT_MS[provider] ?? 30000,
      });
      if (result.ok && result.text?.trim()) {
        return { ok: true, text: result.text, provider: result.provider || provider };
      }
      errors.push(`${provider}: ${(!result.ok && result.error) || "empty reply"}`);
    } catch (err) {
      errors.push(`${provider}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: false, error: `All providers failed — ${errors.join(" | ")}` };
}

export async function POST(req: NextRequest) {
  try {
    const body: SceneChatRequest = await req.json();

    const system = buildSystemPrompt(body);
    const prompt = buildUserPrompt(body);

    // Build the provider chain.
    // - "auto" (or unset) → ollama → openai → claude
    // - any explicit pick → just that one
    const requested: ChatProvider = body.provider || "auto";
    const chain: Array<"ollama" | "openai" | "claude"> =
      requested === "auto" ? ["ollama", "openai", "claude"] : [requested];

    const result = await runWithFallback(prompt, system, chain);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    const imagePromptSuggestion = extractImagePrompt(result.text);

    return NextResponse.json({
      ok: true,
      reply: result.text,
      ...(imagePromptSuggestion !== undefined && { imagePromptSuggestion }),
      provider: result.provider,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
