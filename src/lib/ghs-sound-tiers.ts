// GioHomeStudio — Sound Tier Definitions
// Single source of truth for all 4 GHS sound tiers.
// Every UI selector, music provider router, and narration dispatcher
// must reference these constants — never hardcode tier strings elsewhere.
//
// Each tier now bundles FOUR sub-systems:
//   1. Narration TTS  — single-narrator voice (story/documentary mode)
//   2. Music provider — backing track for the scene
//   3. MCD (Multi-Cast Dialogue) — character-to-character speech with emotion + pacing
//   4. Lip-sync model — drives mouth movement on scene videos from MCD audio
//
// One project-level tier picks all four. Users see one selector + one "What's
// included" tooltip per tier rather than juggling separate dialogue/lipsync menus.
//
// 2026-05-08: MCD + lipsync fields added (DIALOGUE-01).

export const GHS_SOUND_TIERS = [
  {
    id: "ghs-sound",
    label: "GHS Sound",
    description: "Piper TTS narration (local, free, offline) + stock music + no lip-sync.",
    provider: "piper",
    model: "en_US-lessac-medium",
    isFree: true,
    requiresKey: false,
    // ── MCD bundle ──
    mcdLabel: "MCD Free",
    mcdTtsProvider: "piper",          // /api/tts provider field
    mcdEmotionMode: "off" as const,   // off | basic | v3-tags
    mcdLipsync: "off" as const,       // off | musetalk | sync-lipsync
    estCostPer100s: "$0.00",          // shown in tooltip
    quality: "Hobby / draft",
    includes: [
      "Piper TTS narration (local, free, offline)",
      "Piper voices for dialogue (basic, no emotion)",
      "Stock music library",
      "Stock SFX library",
      "No lip-sync",
    ],
  },
  {
    id: "ghs-plus",
    label: "GHS Plus",
    description: "FAL AI Kokoro narration + ElevenLabs dialogue + FAL MuSeTalk lip-sync.",
    provider: "karaoke",
    model: "karaoke-pipeline",
    isFree: false,
    requiresKey: false,
    mcdLabel: "MCD Standard",
    mcdTtsProvider: "elevenlabs",
    mcdEmotionMode: "basic" as const, // detect ?/!/CAPS, tune ElevenLabs voice_settings
    mcdLipsync: "musetalk" as const,
    estCostPer100s: "~$0.80",
    quality: "70% Gemini feel",
    includes: [
      "FAL AI Kokoro narration (cloud TTS, no install)",
      "ElevenLabs v1 TTS for dialogue",
      "ElevenLabs basic emotion detection (!/? /CAPS)",
      "Stock music library",
      "Stock SFX library",
      "FAL MuSeTalk lip-sync on scene videos",
    ],
  },
  {
    id: "ghs-pro",
    label: "GHS Pro",
    description: "FAL AI Kokoro narration + FAL Stable Audio music + Scene Intelligence SFX.",
    provider: "karaoke+fal",
    model: "karaoke-pipeline+fal-stable-audio",
    isFree: false,
    requiresKey: true,
    requiredKey: "FAL_KEY",
    mcdLabel: "MCD Standard",
    mcdTtsProvider: "elevenlabs",
    mcdEmotionMode: "basic" as const,
    mcdLipsync: "musetalk" as const,
    estCostPer100s: "~$0.95",
    quality: "70% Gemini feel + AI music",
    includes: [
      "FAL AI Kokoro narration (cloud TTS, no install)",
      "ElevenLabs v1 TTS for dialogue",
      "ElevenLabs basic emotion (detects !/? /CAPS)",
      "FAL Stable Audio AI music (≤47s per scene)",
      "Stock SFX + Scene Intelligence (auto-detects environment sounds)",
      "FAL MuSeTalk lip-sync",
    ],
  },
  {
    id: "ghs-premium",
    label: "GHS Premium",
    description: "Kie.ai Suno V5 music + ElevenLabs v3 emotion dialogue + Sync Labs lip-sync.",
    provider: "kie-suno",
    model: "suno-v5",
    isFree: false,
    requiresKey: true,
    requiredKey: "KIE_AI_API_KEY",
    mcdLabel: "MCD Pro",
    mcdTtsProvider: "elevenlabs",
    mcdEmotionMode: "v3-tags" as const, // ElevenLabs v3 model with <emotion> tags
    mcdLipsync: "sync-lipsync" as const,
    estCostPer100s: "~$1.30",
    quality: "90% Gemini feel",
    includes: [
      "Kie.ai Suno V5 narration (premium music-grade TTS)",
      "Kie.ai Suno V5 AI music (full lyrical + instrumental)",
      "ElevenLabs v3 TTS for dialogue",
      "ElevenLabs v3 rich emotion tags (<emotion> in text)",
      "Stock SFX + Scene Intelligence",
      "Sync Labs lip-sync (gold standard, video-only)",
    ],
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
 * Pull the MCD (Multi-Cast Dialogue) config for a given tier.
 * Used by movie-planner to decide which TTS engine, emotion mode, and
 * lip-sync model to use when the user clicks "Generate Dialogue".
 *
 * Why this exists: each tier hard-codes its own MCD bundle so the user picks
 * ONCE — they don't see separate dialogue / emotion / lip-sync menus.
 */
export function soundTierToMCDConfig(id: GhsSoundTierId): {
  ttsProvider: string;
  emotionMode: "off" | "basic" | "v3-tags";
  lipsync: "off" | "musetalk" | "sync-lipsync";
  label: string;
  estCostPer100s: string;
} {
  const tier = getSoundTier(id);
  return {
    ttsProvider: tier.mcdTtsProvider,
    emotionMode: tier.mcdEmotionMode,
    lipsync: tier.mcdLipsync,
    label: tier.mcdLabel,
    estCostPer100s: tier.estCostPer100s,
  };
}

/**
 * Map a GhsSoundTierId to the narration provider string expected by
 * /api/hybrid/narrate-piper (voiceProvider field).
 *
 * "ghs-sound"    → "piper"      (en_US-lessac-medium, free local)
 * "ghs-plus"     → "karaoke"    (GHS Karaoke pipeline: FAL Kokoro or Piper fallback)
 * "ghs-pro"      → "karaoke"    (GHS Karaoke pipeline: FAL Kokoro or Piper fallback)
 * "ghs-premium"  → "kie-suno"   (Kie.ai Suno — falls back to piper if key missing)
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
