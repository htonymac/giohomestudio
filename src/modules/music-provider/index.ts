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
 *   instrumental, duration  > 47s → mubert        (if MUBERT_PAT set)
 *                               → stock           (fallback)
 */
export function pickAutomaticProvider(input: MusicGenerateInput): MusicProviderAdapter {
  if (input.hasLyrics) {
    if (process.env.KIE_AI_API_KEY) return kieAdapter;
    return stockAdapter;
  }

  // Instrumental path
  if (input.durationSeconds <= 47) {
    if (process.env.FAL_KEY) return stableAudioAdapter;
    if (process.env.MUBERT_PAT) return mubertAdapter;
    return stockAdapter;
  }

  // Longer instrumental
  if (process.env.MUBERT_PAT) return mubertAdapter;
  if (process.env.FAL_KEY && input.durationSeconds <= 47) return stableAudioAdapter;
  return stockAdapter;
}

/** List all registered provider keys */
export function listMusicProviderKeys(): MusicProviderKey[] {
  return Object.keys(PROVIDERS) as MusicProviderKey[];
}
