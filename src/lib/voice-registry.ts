// GioHomeStudio — Voice Registry
// Single source of truth for ALL voice definitions across ALL providers.
// Every voice picker UI must import voices from here. No hardcoded voice lists
// in pages/components. Adding a new voice = ONE entry here.
//
// Mirrors the pattern in src/lib/aid-model-registry.ts (for video+image) and
// src/lib/ghs-sound-tiers.ts (for the GHS Sound bundle).
//
// Tier mapping (matches GHS branding rule: NEVER show real model names in UI):
//   GHS Standard   = free local Piper voices
//   GHS Standard+  = free cloud Edge-TTS (Microsoft Neural)
//   GHS Standard B = free cloud gTTS (Google Translate fallback)
//   GHS Pro        = paid FAL F5-TTS / XTTS / Bark
//   GHS Premium    = paid FAL Gemini 2.5 Flash TTS
//   GHS Best       = paid ElevenLabs (Flash / Multilingual)
//
// Locked 2026-06-04 per VOICE_PICKER_AUDIT_06042026.md

export type VoiceProvider =
  | "piper"          // local CPU TTS
  | "edge-tts"       // MS Edge neural, free
  | "gtts"           // Google Translate fallback, free
  | "fal-f5"         // FAL F5-TTS, paid
  | "fal-xtts"       // FAL XTTS-v2, paid, voice cloning
  | "fal-bark"       // FAL Bark, paid, character voices
  | "fal-gemini"     // FAL Gemini 2.5 Flash TTS, paid
  | "fal-kokoro"     // FAL AI Kokoro (existing in /api/tts)
  | "elevenlabs";    // ElevenLabs, paid

export type GhsVoiceTier = "standard" | "standard-plus" | "pro" | "premium" | "best";

export interface VoiceEntry {
  id: string;                    // canonical id e.g. "piper_lessac_us"
  displayName: string;           // shown to user
  provider: VoiceProvider;
  modelId: string;               // provider-specific model name
  tier: GhsVoiceTier;            // GHS branding tier
  language: string;              // BCP-47 code e.g. "en-US"
  country: string;               // country flag-region e.g. "US", "GB", "NG"
  gender: "male" | "female" | "neutral";
  // Henry 2026-06-05: voice TONE — describes character so user picks before listening.
  // Choose from: "bass" (deepest male) | "baritone" | "tenor" (high male) | "alto" (low female)
  //            | "soprano" (high female) | "warm" | "bright" | "deep" | "neutral"
  //            | "child" | "elderly" | "news" | "narration" | "cheerful" | "dramatic"
  tone?: string;
  ageType?: "child" | "young-adult" | "adult" | "elderly";
  sampleText?: string;           // for preview button
  pricePerMin: number;           // estimated, USD
  notes?: string;
}

export const VOICE_REGISTRY: VoiceEntry[] = [
  // ── GHS Standard (Piper, local, free) ────────────────────────────────────
  { id: "piper_lessac_us",     displayName: "Lessac",       provider: "piper", modelId: "en_US-lessac-medium",        tier: "standard", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0,    notes: "Default narrator" },
  { id: "piper_amy_us",        displayName: "Amy",          provider: "piper", modelId: "en_US-amy-medium",           tier: "standard", language: "en-US", country: "US", gender: "female",  pricePerMin: 0,    notes: "Gentle storyteller" },
  { id: "piper_ryan_us",       displayName: "Ryan",         provider: "piper", modelId: "en_US-ryan-high",            tier: "standard", language: "en-US", country: "US", gender: "male",    pricePerMin: 0 },
  { id: "piper_alan_gb",       displayName: "Alan",         provider: "piper", modelId: "en_GB-alan-medium",          tier: "standard", language: "en-GB", country: "GB", gender: "male",    pricePerMin: 0 },
  { id: "piper_libritts_us",   displayName: "Libritts",     provider: "piper", modelId: "en_US-libritts_r-medium",    tier: "standard", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0 },

  // ── GHS Standard+ (Edge-TTS, cloud, free) — Nigerian + US (12 voices) + UK + AU ──
  // 🇳🇬 NIGERIAN —
  { id: "edge_ezinne_ng",      displayName: "Ezinne",       provider: "edge-tts", modelId: "en-NG-EzinneNeural",    tier: "standard-plus", language: "en-NG", country: "NG", gender: "female", tone: "warm",       ageType: "adult",       pricePerMin: 0, notes: "🇳🇬 Nigerian neural — market advantage" },
  { id: "edge_abeo_ng",        displayName: "Abeo",         provider: "edge-tts", modelId: "en-NG-AbeoNeural",      tier: "standard-plus", language: "en-NG", country: "NG", gender: "male",   tone: "baritone",   ageType: "adult",       pricePerMin: 0, notes: "🇳🇬 Nigerian neural" },
  // 🇺🇸 US MALE — bass / baritone / tenor / warm
  { id: "edge_christopher_us", displayName: "Christopher",  provider: "edge-tts", modelId: "en-US-ChristopherNeural", tier: "standard-plus", language: "en-US", country: "US", gender: "male",   tone: "bass",       ageType: "adult",       pricePerMin: 0, notes: "Deep bass — authoritative narrator" },
  { id: "edge_roger_us",       displayName: "Roger",        provider: "edge-tts", modelId: "en-US-RogerNeural",     tier: "standard-plus", language: "en-US", country: "US", gender: "male",   tone: "deep",       ageType: "adult",       pricePerMin: 0, notes: "Mature deep voice" },
  { id: "edge_steffan_us",     displayName: "Steffan",      provider: "edge-tts", modelId: "en-US-SteffanNeural",   tier: "standard-plus", language: "en-US", country: "US", gender: "male",   tone: "warm narration", ageType: "adult",   pricePerMin: 0, notes: "Warm storyteller" },
  { id: "edge_brian_us",       displayName: "Brian",        provider: "edge-tts", modelId: "en-US-BrianNeural",     tier: "standard-plus", language: "en-US", country: "US", gender: "male",   tone: "baritone",   ageType: "young-adult", pricePerMin: 0, notes: "Friendly young adult" },
  { id: "edge_eric_us",        displayName: "Eric",         provider: "edge-tts", modelId: "en-US-EricNeural",      tier: "standard-plus", language: "en-US", country: "US", gender: "male",   tone: "bright",     ageType: "young-adult", pricePerMin: 0, notes: "Clear bright male" },
  { id: "edge_guy_us",         displayName: "Guy",          provider: "edge-tts", modelId: "en-US-GuyNeural",       tier: "standard-plus", language: "en-US", country: "US", gender: "male",   tone: "tenor",      ageType: "young-adult", pricePerMin: 0, notes: "Approachable upper-male" },
  { id: "edge_andrew_us",      displayName: "Andrew",       provider: "edge-tts", modelId: "en-US-AndrewMultilingualNeural", tier: "standard-plus", language: "en-US", country: "US", gender: "male", tone: "baritone", ageType: "adult", pricePerMin: 0, notes: "Multilingual narrator" },
  // 🇺🇸 US FEMALE — soprano / alto / storytelling / cheerful / child
  { id: "edge_aria_us",        displayName: "Aria",         provider: "edge-tts", modelId: "en-US-AriaNeural",      tier: "standard-plus", language: "en-US", country: "US", gender: "female", tone: "soprano",    ageType: "young-adult", pricePerMin: 0, notes: "Bright soprano" },
  { id: "edge_jenny_us",       displayName: "Jenny",        provider: "edge-tts", modelId: "en-US-JennyNeural",     tier: "standard-plus", language: "en-US", country: "US", gender: "female", tone: "narration",  ageType: "adult",       pricePerMin: 0, notes: "Storytelling — best for children's content" },
  { id: "edge_emma_us",        displayName: "Emma",         provider: "edge-tts", modelId: "en-US-EmmaMultilingualNeural", tier: "standard-plus", language: "en-US", country: "US", gender: "female", tone: "warm",   ageType: "adult",       pricePerMin: 0, notes: "Warm multilingual female" },
  { id: "edge_ava_us",         displayName: "Ava",          provider: "edge-tts", modelId: "en-US-AvaMultilingualNeural", tier: "standard-plus", language: "en-US", country: "US", gender: "female", tone: "soprano",  ageType: "young-adult", pricePerMin: 0, notes: "Bright multilingual" },
  { id: "edge_michelle_us",    displayName: "Michelle",     provider: "edge-tts", modelId: "en-US-MichelleNeural",  tier: "standard-plus", language: "en-US", country: "US", gender: "female", tone: "alto",       ageType: "adult",       pricePerMin: 0, notes: "Mid-range female" },
  { id: "edge_ana_us",         displayName: "Ana",          provider: "edge-tts", modelId: "en-US-AnaNeural",       tier: "standard-plus", language: "en-US", country: "US", gender: "female", tone: "child",      ageType: "child",       pricePerMin: 0, notes: "👶 Child voice — best for educational kid characters" },
  // 🇬🇧 UK + 🇦🇺 AU
  { id: "edge_ryan_gb",        displayName: "Ryan-UK",      provider: "edge-tts", modelId: "en-GB-RyanNeural",      tier: "standard-plus", language: "en-GB", country: "GB", gender: "male",   tone: "tenor",      ageType: "young-adult", pricePerMin: 0, notes: "British tenor" },
  { id: "edge_sonia_gb",       displayName: "Sonia",        provider: "edge-tts", modelId: "en-GB-SoniaNeural",     tier: "standard-plus", language: "en-GB", country: "GB", gender: "female", tone: "soprano",    ageType: "adult",       pricePerMin: 0, notes: "British soprano" },
  { id: "edge_libby_gb",       displayName: "Libby",        provider: "edge-tts", modelId: "en-GB-LibbyNeural",     tier: "standard-plus", language: "en-GB", country: "GB", gender: "female", tone: "warm",       ageType: "adult",       pricePerMin: 0, notes: "Warm British female" },
  { id: "edge_natasha_au",     displayName: "Natasha",      provider: "edge-tts", modelId: "en-AU-NatashaNeural",   tier: "standard-plus", language: "en-AU", country: "AU", gender: "female", tone: "alto",       ageType: "adult",       pricePerMin: 0, notes: "Aussie alto" },
  { id: "edge_william_au",     displayName: "William",      provider: "edge-tts", modelId: "en-AU-WilliamNeural",   tier: "standard-plus", language: "en-AU", country: "AU", gender: "male",   tone: "baritone",   ageType: "adult",       pricePerMin: 0, notes: "Aussie baritone" },

  // ── GHS Standard B (gTTS fallback) ───────────────────────────────────────
  { id: "gtts_en_us",          displayName: "gTTS US",      provider: "gtts", modelId: "en-us",                     tier: "standard", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0, notes: "Fallback only" },
  { id: "gtts_en_gb",          displayName: "gTTS UK",      provider: "gtts", modelId: "en-uk",                     tier: "standard", language: "en-GB", country: "GB", gender: "neutral", pricePerMin: 0, notes: "Fallback only" },

  // ── GHS Pro (FAL F5-TTS, paid, expressive) ───────────────────────────────
  { id: "fal_f5_default",      displayName: "F5 Default",   provider: "fal-f5",    modelId: "fal-ai/f5-tts",        tier: "pro", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0.03, notes: "Newest expressive TTS" },

  // ── GHS Pro (FAL XTTS-v2, voice cloning) ─────────────────────────────────
  { id: "fal_xtts_clone",      displayName: "XTTS Clone",   provider: "fal-xtts",  modelId: "fal-ai/xtts-v2",        tier: "pro", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0.04, notes: "Voice cloning supported" },

  // ── GHS Pro (FAL Bark, character voices) ─────────────────────────────────
  { id: "fal_bark_default",    displayName: "Bark",         provider: "fal-bark",  modelId: "fal-ai/bark",           tier: "pro", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0.05, notes: "Character & SFX voices" },

  // ── GHS Premium (FAL Gemini 2.5 Flash TTS) ───────────────────────────────
  { id: "fal_gemini_zephyr",   displayName: "Zephyr",       provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "neutral", pricePerMin: 0.06 },
  { id: "fal_gemini_puck",     displayName: "Puck",         provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "male",    pricePerMin: 0.06 },
  { id: "fal_gemini_charon",   displayName: "Charon",       provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "male",    pricePerMin: 0.06 },
  { id: "fal_gemini_kore",     displayName: "Kore",         provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "female",  pricePerMin: 0.06 },
  { id: "fal_gemini_fenrir",   displayName: "Fenrir",       provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "male",    pricePerMin: 0.06 },
  { id: "fal_gemini_leda",     displayName: "Leda",         provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "female",  pricePerMin: 0.06 },
  { id: "fal_gemini_aoede",    displayName: "Aoede",        provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "female",  pricePerMin: 0.06 },
  { id: "fal_gemini_orus",     displayName: "Orus",         provider: "fal-gemini", modelId: "fal-ai/gemini-flash-tts", tier: "premium", language: "en-US", country: "US", gender: "male",    pricePerMin: 0.06 },

  // ── GHS Best (ElevenLabs, paid top tier) ─────────────────────────────────
  { id: "el_sarah",            displayName: "Sarah",        provider: "elevenlabs", modelId: "EXAVITQu4vr4xnSDxMaL", tier: "best", language: "en-US", country: "US", gender: "female", pricePerMin: 0.30, notes: "Warm female" },
  { id: "el_rachel",           displayName: "Rachel",       provider: "elevenlabs", modelId: "21m00Tcm4TlvDq8ikWAM", tier: "best", language: "en-US", country: "US", gender: "female", pricePerMin: 0.30 },
  { id: "el_domi",             displayName: "Domi",         provider: "elevenlabs", modelId: "AZnzlk1XvdvUeBnXmlld", tier: "best", language: "en-US", country: "US", gender: "female", pricePerMin: 0.30, notes: "Fierce female" },
  { id: "el_elli",             displayName: "Elli",         provider: "elevenlabs", modelId: "MF3mGyEYCl7XYWbV9V6O", tier: "best", language: "en-US", country: "US", gender: "female", pricePerMin: 0.30, notes: "Bright female" },
  { id: "el_josh",             displayName: "Josh",         provider: "elevenlabs", modelId: "TxGEqnHWrfWFTfGW9XjX", tier: "best", language: "en-US", country: "US", gender: "male",   pricePerMin: 0.30, notes: "Clear male" },
  { id: "el_arnold",           displayName: "Arnold",       provider: "elevenlabs", modelId: "VR6AewLTigWG4xSOukaG", tier: "best", language: "en-US", country: "US", gender: "male",   pricePerMin: 0.30, notes: "Crisp male" },
  { id: "el_adam",             displayName: "Adam",         provider: "elevenlabs", modelId: "pNInz6obpgDQGcFmaJgB", tier: "best", language: "en-US", country: "US", gender: "male",   pricePerMin: 0.30, notes: "Narrative male" },
  { id: "el_sam",              displayName: "Sam",          provider: "elevenlabs", modelId: "yoZ06aMxZJJ28mfd3POQ", tier: "best", language: "en-US", country: "US", gender: "male",   pricePerMin: 0.30 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getVoiceById(id: string): VoiceEntry | undefined {
  return VOICE_REGISTRY.find(v => v.id === id);
}

export function getVoicesByTier(tier: GhsVoiceTier): VoiceEntry[] {
  return VOICE_REGISTRY.filter(v => v.tier === tier);
}

export function getVoicesByCountry(country: string): VoiceEntry[] {
  return VOICE_REGISTRY.filter(v => v.country === country);
}

export function getVoicesByLanguage(lang: string): VoiceEntry[] {
  return VOICE_REGISTRY.filter(v => v.language.startsWith(lang));
}

export function getVoicesByProvider(provider: VoiceProvider): VoiceEntry[] {
  return VOICE_REGISTRY.filter(v => v.provider === provider);
}

// Default voice per tier — Henry 2026-06-05: must be RANDOM each pick, never
// deterministic. Reason: deterministic default = same voice every project = boring.
// Each new project draws a fresh voice from the tier.
export function defaultVoiceForTier(tier: GhsVoiceTier): VoiceEntry {
  const candidates = getVoicesByTier(tier);
  if (candidates.length === 0) return getVoiceById("piper_lessac_us")!;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Random voice across the WHOLE registry (any tier). Used by planners that want
// a fully random default on project init.
export function randomVoiceAnyTier(freeTiersOnly = true): VoiceEntry {
  const pool = freeTiersOnly
    ? VOICE_REGISTRY.filter(v => FREE_TIERS.has(v.tier))
    : VOICE_REGISTRY;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Branding label per tier — what the user sees in the picker.
export function tierLabel(tier: GhsVoiceTier): string {
  return ({
    "standard":      "GHS Standard",
    "standard-plus": "GHS Standard+",
    "pro":           "GHS Pro",
    "premium":       "GHS Premium",
    "best":          "GHS Best",
  } as const)[tier];
}

// Tier ordering for UI display
export const TIER_ORDER: GhsVoiceTier[] = ["standard", "standard-plus", "pro", "premium", "best"];

// FREE tier set (used for tier-gating). Free users can pick from these only.
export const FREE_TIERS: ReadonlySet<GhsVoiceTier> = new Set(["standard", "standard-plus"] as const);

export function isFreeTier(tier: GhsVoiceTier): boolean {
  return FREE_TIERS.has(tier);
}
