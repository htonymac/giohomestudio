// GET  /api/settings/llm  — returns provider status, masked keys, Ollama models, role assignments
// POST /api/settings/llm  — saves API keys + role assignments to storage/llm-settings.json

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadLLMSettings, saveLLMSettings, getLLMSettingsStatus } from "@/lib/llm-settings";

export async function GET() {
  const settings = loadLLMSettings();
  const status   = getLLMSettingsStatus();

  // Mask keys — show only first 8 chars so user can verify which key is loaded
  function mask(key: string | undefined): string {
    if (!key) return "";
    return key.slice(0, 8) + "••••••••••••••••";
  }

  const serviceStatus = {
    elevenlabs: settings.ELEVENLABS_API_KEY ? "configured" : "not_configured",
    kling:      (settings.KLING_ACCESS_KEY && settings.KLING_SECRET_KEY) ? "configured" : "not_configured",
    runway:     settings.RUNWAY_API_KEY ? "configured" : "not_configured",
  } as const;

  // Fetch Ollama models list
  let ollamaModels: string[] = [];
  try {
    const r = await fetch(`${settings.OLLAMA_BASE_URL || "http://localhost:11434"}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) {
      const data = await r.json();
      ollamaModels = (data.models ?? []).map((m: { name: string }) => m.name);
    }
  } catch { /* Ollama offline */ }

  return NextResponse.json({
    status,
    serviceStatus,
    forced:           settings.LLM_PROVIDER || null,
    ollamaUrl:        settings.OLLAMA_BASE_URL || "http://localhost:11434",
    maskedKeys: {
      anthropic:   mask(settings.ANTHROPIC_API_KEY),
      openai:      mask(settings.OPENAI_API_KEY),
      grok:        mask(settings.XAI_API_KEY),
      elevenlabs:  mask(settings.ELEVENLABS_API_KEY),
      kling:       mask(settings.KLING_ACCESS_KEY),
      runway:      mask(settings.RUNWAY_API_KEY),
    },
    ollamaModels,
    roleAssignments: {
      fast:       settings.OLLAMA_MODEL_FAST,
      quality:    settings.OLLAMA_MODEL_QUALITY,
      creative:   settings.OLLAMA_MODEL_CREATIVE,
      assistant:  settings.OLLAMA_MODEL_ASSISTANT,
      supervisor: settings.OLLAMA_MODEL_SUPERVISOR,
      vision:     settings.OLLAMA_MODEL_VISION,
    },
  });
}

const schema = z.object({
  ANTHROPIC_API_KEY:       z.string().optional(),
  OPENAI_API_KEY:          z.string().optional(),
  XAI_API_KEY:             z.string().optional(),
  LLM_PROVIDER:            z.enum(["", "claude", "openai", "grok", "ollama"]).optional(),
  OLLAMA_BASE_URL:         z.string().url().optional().or(z.literal("")),
  OLLAMA_MODEL_FAST:       z.string().optional(),
  OLLAMA_MODEL_QUALITY:    z.string().optional(),
  OLLAMA_MODEL_CREATIVE:   z.string().optional(),
  OLLAMA_MODEL_ASSISTANT:  z.string().optional(),
  OLLAMA_MODEL_SUPERVISOR: z.string().optional(),
  OLLAMA_MODEL_VISION:     z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  KLING_ACCESS_KEY:   z.string().optional(),
  KLING_SECRET_KEY:   z.string().optional(),
  RUNWAY_API_KEY:     z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  saveLLMSettings(parsed.data);

  return NextResponse.json({ ok: true, message: "LLM settings saved. Active on next request." });
}
