// GioHomeStudio — Music Provider Layer
// Central entry point. Never import adapter files directly from outside this module.
//
// Usage:
//   import { getMusicProvider, pickAutomaticProvider } from "@/modules/music-provider";

export type { MusicGenerateInput, MusicGenerateOutput, MusicProviderAdapter, MusicProviderCapabilities } from "./types";

import { kieAdapter } from "./adapters/kie.adapter";
import { mubertAdapter } from "./adapters/mubert.adapter";
import { stableAudioAdapter } from "./adapters/stable-audio.adapter";
import { stockAdapter } from "./adapters/stock.adapter";
import type { MusicProviderAdapter, MusicGenerateInput } from "./types";

export type MusicProviderKey = "kie" | "mubert" | "stable_audio" | "stock";

const PROVIDERS: Record<MusicProviderKey, MusicProviderAdapter> = {
  kie: kieAdapter,
  mubert: mubertAdapter,
  stable_audio: stableAudioAdapter,
  stock: stockAdapter,
};

/** Get a provider by exact key. Throws if key is unknown. */
export function getMusicProvider(key: MusicProviderKey): MusicProviderAdapter {
  const provider = PROVIDERS[key];
  if (!provider) throw new Error(`Unknown music provider key: "${key}"`);
  return provider;
}

/**
 * Auto-route based on input characteristics and available env keys.
 *
 * Routing rules:
 *   hasLyrics: true   → kie    (if KIE_AI_API_KEY set)
 *                      → stock (fallback)
 *   instrumental, duration ≤ 47s → stable_audio  (if FAL_KEY set)
 *                               → mubert          (if MUBERT_PAT set, as alternative)
 *                               → stock           (final fallback)
 *   instrumental, duration  > 47s → mubert        (if MUBERT_PAT set)
 *                               → stock           (fallback — logs warning)
 */
export function pickAutomaticProvider(input: MusicGenerateInput): MusicProviderAdapter {
  return pickAutomaticProviderWithReason(input).adapter;
}

/** Same routing logic but also returns a fallbackReason string when stock is chosen due to missing config. */
export function pickAutomaticProviderWithReason(
  input: MusicGenerateInput,
): { adapter: MusicProviderAdapter; fallbackReason?: string } {
  if (input.hasLyrics) {
    if (process.env.KIE_AI_API_KEY) return { adapter: kieAdapter };
    return {
      adapter: stockAdapter,
      fallbackReason: "KIE_AI_API_KEY not configured — using stock library for lyrical tracks",
    };
  }

  // Instrumental ≤ 47s — FAL Stable Audio preferred
  if (input.durationSeconds <= 47) {
    if (process.env.FAL_KEY) return { adapter: stableAudioAdapter };
    if (process.env.MUBERT_PAT) return { adapter: mubertAdapter };
    return {
      adapter: stockAdapter,
      fallbackReason: "FAL_KEY and MUBERT_PAT not configured — using stock library",
    };
  }

  // Longer instrumental (> 47s) — Mubert required; FAL Stable Audio caps at 47s
  if (process.env.MUBERT_PAT) return { adapter: mubertAdapter };

  // MUBERT_PAT not set — warn and fall back to stock library
  const reason = `MUBERT_PAT not configured — using stock library for tracks >47s (${input.durationSeconds}s requested)`;
  console.warn(`[music-provider] ${reason}. Set MUBERT_PAT to enable Mubert B2B.`);
  return { adapter: stockAdapter, fallbackReason: reason };
}

/** List all registered provider keys */
export function listMusicProviderKeys(): MusicProviderKey[] {
  return Object.keys(PROVIDERS) as MusicProviderKey[];
}
