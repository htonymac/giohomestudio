// GioHomeStudio — Music Provider Layer
// Central entry point. Never import adapter files directly from outside this module.
//
// Usage:
//   import { getMusicProvider, pickAutomaticProvider } from "@/modules/music-provider";
//   import { getMusicProviderForSoundTier } from "@/modules/music-provider";

export type { MusicGenerateInput, MusicGenerateOutput, MusicProviderAdapter, MusicProviderCapabilities } from "./types";

import { kieAdapter } from "./adapters/kie.adapter";
import { mubertAdapter } from "./adapters/mubert.adapter";
import { stableAudioAdapter } from "./adapters/stable-audio.adapter";
import { stockAdapter } from "./adapters/stock.adapter";
import type { MusicProviderAdapter, MusicGenerateInput } from "./types";
import { soundTierToMusicProviderKey } from "@/lib/ghs-sound-tiers";
import type { GhsSoundTierId } from "@/lib/ghs-sound-tiers";

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

/**
 * Resolve a music provider adapter directly from a GHS sound tier id.
 *
 * Tier mapping:
 *   ghs-sound    → stock         (Piper TTS is for narration; background music = stock)
 *   ghs-plus     → stock         (Karaoke pipeline for narration; background music = stock)
 *   ghs-pro      → stable_audio  (FAL Stable Audio for music; requires FAL_KEY)
 *   ghs-premium  → kie           (Kie.ai Suno V5; requires KIE_AI_API_KEY)
 *
 * Falls back gracefully when required env keys are absent:
 *   ghs-pro without FAL_KEY      → stock  (logs warning)
 *   ghs-premium without KIE key  → stock  (logs warning)
 */
export function getMusicProviderForSoundTier(tierId: GhsSoundTierId): {
  adapter: MusicProviderAdapter;
  resolvedKey: MusicProviderKey;
  fallbackReason?: string;
} {
  const targetKey = soundTierToMusicProviderKey(tierId);

  // Guard: ghs-pro requires FAL_KEY
  if (targetKey === "stable_audio" && !process.env.FAL_KEY) {
    const reason = `FAL_KEY not configured — tier "${tierId}" requires FAL_KEY for Stable Audio. Using stock library.`;
    console.warn(`[music-provider] ${reason}`);
    return { adapter: stockAdapter, resolvedKey: "stock", fallbackReason: reason };
  }

  // Guard: ghs-premium requires KIE_AI_API_KEY
  if (targetKey === "kie" && !process.env.KIE_AI_API_KEY) {
    const reason = `KIE_AI_API_KEY not configured — tier "${tierId}" requires KIE_AI_API_KEY for Kie Suno V5. Using stock library.`;
    console.warn(`[music-provider] ${reason}`);
    return { adapter: stockAdapter, resolvedKey: "stock", fallbackReason: reason };
  }

  return { adapter: PROVIDERS[targetKey], resolvedKey: targetKey };
}
