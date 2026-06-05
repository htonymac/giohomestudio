// GioHomeStudio — TTS Gateway
// ALL TTS calls route through this single dispatcher. No direct provider
// fetches from pages, API routes, or other libs.
//
// Mirrors src/lib/generation/gateways/fal.ts pattern. Why this exists:
//   1. Provider hot-swap: switch FAL F5 → another endpoint by editing ONE
//      branch here. No planner / route change.
//   2. Uniform fallback: every provider failure → Piper. No silent fails.
//   3. Uniform error envelope: callers see {ok, audioBase64?, error?} only.
//   4. Centralized cost tracking + rate limit hooks land here later (Phase 5).
//
// Public surface (the ONLY thing other code should call):
//   callTTS({ text, voiceId, options? }) → Promise<TTSResult>
//
// Locked 2026-06-04.

import { getVoiceById, type VoiceEntry, type VoiceProvider } from "../../voice-registry";

export interface TTSRequest {
  text: string;
  voiceId: string;         // canonical id from voice-registry
  speed?: number;          // 0.5-2.0, default 1.0
  format?: "wav" | "mp3";  // output format, default wav
  // Per-provider passthrough — most callers leave this empty.
  providerOpts?: Record<string, unknown>;
}

export interface TTSResult {
  ok: boolean;
  audioBase64?: string;    // base64-encoded audio bytes
  format?: "wav" | "mp3";
  durationMs?: number;
  providerUsed: VoiceProvider;       // actual provider — may differ from requested on fallback
  voiceUsed: string;                 // actual voiceId — may be piper_lessac_us on fallback
  error?: string;                    // present only when fallback also failed
  costEstimate?: number;             // USD, derived from voice.pricePerMin
}

const PIPER_FALLBACK_VOICE_ID = "piper_lessac_us";

export async function callTTS(req: TTSRequest): Promise<TTSResult> {
  const voice = getVoiceById(req.voiceId);

  if (!voice) {
    console.error("[tts-gateway] Unknown voiceId, falling back to Piper:", req.voiceId);
    return tryPiperFallback(req, "unknown_voice_id");
  }

  try {
    const result = await dispatch(voice, req);
    if (result.ok) return result;

    // Provider returned ok=false — log + fall back to Piper (unless we ARE Piper)
    if (voice.provider !== "piper") {
      console.error(`[tts-gateway] Provider ${voice.provider} returned ok=false, falling back to Piper:`, result.error);
      return tryPiperFallback(req, `${voice.provider}_returned_false:${result.error ?? ""}`);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tts-gateway] Provider ${voice.provider} threw, falling back to Piper:`, msg);
    if (voice.provider === "piper") {
      // Piper itself crashed — nothing to fall back to.
      return { ok: false, providerUsed: "piper", voiceUsed: voice.modelId, error: `piper_threw:${msg}` };
    }
    return tryPiperFallback(req, `${voice.provider}_threw:${msg}`);
  }
}

async function tryPiperFallback(req: TTSRequest, reason: string): Promise<TTSResult> {
  const fallbackVoice = getVoiceById(PIPER_FALLBACK_VOICE_ID)!;
  try {
    const res = await dispatch(fallbackVoice, { ...req, voiceId: PIPER_FALLBACK_VOICE_ID });
    return { ...res, error: `fallback_used:${reason}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tts-gateway] PIPER FALLBACK ALSO FAILED:", msg);
    return { ok: false, providerUsed: "piper", voiceUsed: PIPER_FALLBACK_VOICE_ID, error: `fallback_failed:${reason}|piper_failed:${msg}` };
  }
}

// ── Provider dispatch ────────────────────────────────────────────────────────
async function dispatch(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  switch (voice.provider) {
    case "piper":       return callPiper(voice, req);
    case "edge-tts":    return callEdgeTTS(voice, req);
    case "gtts":        return callGTTS(voice, req);
    case "fal-f5":      return callFalF5(voice, req);
    case "fal-xtts":    return callFalXTTS(voice, req);
    case "fal-bark":    return callFalBark(voice, req);
    case "fal-gemini":  return callFalGemini(voice, req);
    case "fal-kokoro":  return callFalKokoro(voice, req);
    case "elevenlabs":  return callElevenLabs(voice, req);
    default: {
      const exhaustive: never = voice.provider;
      throw new Error(`Unknown provider: ${exhaustive}`);
    }
  }
}

// ── Stub implementations ─────────────────────────────────────────────────────
// Phase 1 will wire these to the actual /api/tts/* sub-routes. For now they
// throw — which triggers automatic Piper fallback. This lets the registry +
// gateway land cleanly without breaking anything; once Phase 1 implements
// each branch, callers (planners) don't need any code change.

async function callPiper(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  // Delegates to /api/tts (provider=piper) — the existing route.
  return delegateToInternalRoute(voice, req);
}

async function callEdgeTTS(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  // Phase 1 will implement: child_process spawn `edge-tts --voice <modelId> --text <text> --write-media`
  throw new Error("edge-tts not yet wired (Phase 1)");
}

async function callGTTS(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  // Phase 1: python -c "from gtts import gTTS; gTTS(...).save(...)"
  throw new Error("gtts not yet wired (Phase 1)");
}

async function callFalF5(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  // Phase 1: queue/poll fal-ai/f5-tts
  throw new Error("fal-f5 not yet wired (Phase 1)");
}

async function callFalXTTS(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  throw new Error("fal-xtts not yet wired (Phase 1)");
}

async function callFalBark(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  throw new Error("fal-bark not yet wired (Phase 1)");
}

async function callFalGemini(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  // Delegates to existing /api/tts/gemini route (already implemented for Ad Editor)
  return delegateToGeminiRoute(voice, req);
}

async function callFalKokoro(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  return delegateToInternalRoute(voice, req);
}

async function callElevenLabs(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  return delegateToInternalRoute(voice, req);
}

// ── Internal route delegation (until Phase 1 wires direct provider calls) ────
async function delegateToInternalRoute(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  // Talk to the local Next.js TTS route. Use 127.0.0.1 to skip the
  // site-lock middleware (which only checks the host header).
  const port = process.env.PORT || process.env.NEXT_PORT || "3200";
  const url = `http://127.0.0.1:${port}/api/tts`;
  const body = {
    text: req.text,
    provider: voice.provider,
    voiceId: voice.modelId,
    speed: req.speed ?? 1.0,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Host": "localhost" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, providerUsed: voice.provider, voiceUsed: voice.modelId, error: `route_status_${res.status}` };
  }
  const data = await res.json() as { audioBase64?: string; durationMs?: number; error?: string };
  if (data.error || !data.audioBase64) {
    return { ok: false, providerUsed: voice.provider, voiceUsed: voice.modelId, error: data.error ?? "no_audio" };
  }
  return {
    ok: true,
    audioBase64: data.audioBase64,
    format: "wav",
    durationMs: data.durationMs,
    providerUsed: voice.provider,
    voiceUsed: voice.modelId,
    costEstimate: voice.pricePerMin * ((data.durationMs ?? 0) / 60000),
  };
}

async function delegateToGeminiRoute(voice: VoiceEntry, req: TTSRequest): Promise<TTSResult> {
  const port = process.env.PORT || process.env.NEXT_PORT || "3200";
  const url = `http://127.0.0.1:${port}/api/tts/gemini`;
  const body = { text: req.text, voice: voice.displayName, speed: req.speed ?? 1.0 };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Host": "localhost" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, providerUsed: voice.provider, voiceUsed: voice.modelId, error: `gemini_status_${res.status}` };
  }
  const data = await res.json() as { audioUrl?: string; audioBase64?: string; durationMs?: number; error?: string };
  if (data.error || (!data.audioBase64 && !data.audioUrl)) {
    return { ok: false, providerUsed: voice.provider, voiceUsed: voice.modelId, error: data.error ?? "no_audio" };
  }
  return {
    ok: true,
    audioBase64: data.audioBase64,
    format: "wav",
    durationMs: data.durationMs,
    providerUsed: voice.provider,
    voiceUsed: voice.modelId,
    costEstimate: voice.pricePerMin * ((data.durationMs ?? 0) / 60000),
  };
}
