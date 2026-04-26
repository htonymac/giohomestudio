// Shared Ollama caller for GioHomeStudio.
// Use phi3 (fast, small) for simple text tasks; qwen2.5:14b for complex analysis.
// Falls back gracefully — callers decide what to do when Ollama is unavailable.

const OLLAMA_BASE = "http://localhost:11434";
export const FAST_MODEL    = "phi3:latest";       // 3.8B — captions, narration, polish
export const PRECISE_MODEL = "qwen2.5:14b";       // 14B  — orchestration, complex planning

export interface OllamaOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;         // num_predict
  timeoutMs?: number;
}

export interface OllamaResult {
  text: string;
  ok: true;
}

export interface OllamaError {
  ok: false;
  error: string;
}

export async function callOllama(
  prompt: string,
  system?: string,
  opts: OllamaOptions = {}
): Promise<OllamaResult | OllamaError> {
  const {
    model       = FAST_MODEL,
    temperature = 0.4,
    maxTokens   = 400,
    timeoutMs   = 20000,
  } = opts;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        stream: false,
        keep_alive: "10m",
        options: { temperature, num_predict: maxTokens },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return { ok: false, error: `Ollama HTTP ${res.status}` };

    const data = await res.json();
    const text = (data?.message?.content ?? data?.response ?? "").trim();
    if (!text) return { ok: false, error: "Empty response from Ollama" };

    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Ollama unreachable" };
  }
}
