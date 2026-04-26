// GET /api/llm/status
// Returns which LLM providers are configured and available.
// Useful for debugging "LLM unavailable" errors in the UI.

import { NextResponse } from "next/server";
import { getLLMProviderStatus } from "@/lib/llm";
import { loadLLMSettings } from "@/lib/llm-settings";

export async function GET() {
  const status = getLLMProviderStatus();
  const forced = loadLLMSettings().LLM_PROVIDER?.toLowerCase() || null;

  const activeProviders = Object.entries(status)
    .filter(([, s]) => s === "configured")
    .map(([name]) => name);

  return NextResponse.json({
    providers: status,
    forced: forced,
    activeCount: activeProviders.length,
    willUse: forced ?? (activeProviders[0] ?? "none — all providers unconfigured"),
    note: activeProviders.length === 0
      ? "No LLM providers are configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama locally."
      : null,
  });
}
