// GioHomeStudio — Provider configuration registry
// Swap active providers here without touching pipeline logic.

import { env } from "./env";

export const providerConfig = {
  video: {
    active: "kling" as const,
    available: ["kling"] as const,
  },
  voice: {
    active: "elevenlabs" as const,
    available: ["elevenlabs"] as const,
  },
  music: {
    // Driven by env — allows runtime swapping
    active: env.music.provider as string,
    available: ["kie_ai", "stock_library", "mubert", "stable_audio", "manual"] as const,
    fallback: "stock_library" as const,
  },
  alert: {
    active: "telegram" as const,
    available: ["telegram"] as const,
  },
} as const;
