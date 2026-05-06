// GioHomeStudio — Sound Tier Definitions
// Single source of truth for all 4 GHS sound tiers.
// Every UI selector, music provider router, and narration dispatcher
// must reference these constants — never hardcode tier strings elsewhere.

export const GHS_SOUND_TIERS = [
  {
    id: "ghs-sound",
    label: "GHS Sound",
    description: "Built-in voice synthesis. Fast and free.",
    provider: "piper",
    model: "en_US-lessac-medium",
    isFree: true,
    requiresKey: false,
  },
  {
    id: "ghs-plus",
    label: "GHS Plus",
    description: "Enhanced voice with GHS Karaoke processing.",
    provider: "karaoke",
    model: "karaoke-pipeline",
    isFree: false,
    requiresKey: false,
  },
  {
    id: "ghs-pro",
    label: "GHS Pro",
    description: "Karaoke processing + AI music generation.",
    provider: "karaoke+fal",
    model: "karaoke-pipeline+fal-stable-audio",
    isFree: false,
    requiresKey: true,
    requiredKey: "FAL_KEY",
  },
  {
    id: "ghs-premium",
    label: "GHS Premium",
    description: "Premium AI music via Kie Suno. Best quality.",
    provider: "kie-suno",
    model: "suno-v5",
    isFree: false,
    requiresKey: true,
    requiredKey: "KIE_AI_API_KEY",
  },
] as const;

export type GhsSoundTierId = (typeof GHS_SOUND_TIERS)[number]["id"];

/** Look up a tier definition by id. Throws if id is unknown. */
export function getSoundTier(id: GhsSoundTierId) {
  const tier = GHS_SOUND_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown GHS sound tier: "${id}"`);
  return tier;
}

/**
 * Map a GhsSoundTierId to the internal music provider key used by
 * getMusicProvider() / pickAutomaticProvider().
 *
 * "ghs-sound"    → "stock"        (Piper TTS handles narration; music = stock)
 * "ghs-plus"     → "stock"        (Karaoke pipeline handles voice; background music = stock)
 * "ghs-pro"      → "stable_audio" (Karaoke pipeline + FAL Stable Audio for music)
 * "ghs-premium"  → "kie"          (Kie.ai Suno V5 — full premium music)
 */
export function soundTierToMusicProviderKey(
  id: GhsSoundTierId,
): "kie" | "mubert" | "stable_audio" | "stock" {
  switch (id) {
    case "ghs-sound":
      return "stock";
    case "ghs-plus":
      return "stock";
    case "ghs-pro":
      return "stable_audio";
    case "ghs-premium":
      return "kie";
  }
}

/**
 * Map a GhsSoundTierId to the narration provider string expected by
 * /api/hybrid/narrate-piper (voiceProvider field).
 *
 * "ghs-sound"    → "piper"     (en_US-lessac-medium, free local)
 * "ghs-plus"     → "karaoke"   (GHS Karaoke pipeline)
 * "ghs-pro"      → "karaoke"   (GHS Karaoke pipeline + FAL for music separately)
 * "ghs-premium"  → "kie-suno"  (Kie.ai Suno — falls back to piper if key missing)
 */
export function soundTierToNarrationProvider(
  id: GhsSoundTierId,
): "piper" | "karaoke" | "kie-suno" {
  switch (id) {
    case "ghs-sound":
      return "piper";
    case "ghs-plus":
      return "karaoke";
    case "ghs-pro":
      return "karaoke";
    case "ghs-premium":
      return "kie-suno";
  }
}
