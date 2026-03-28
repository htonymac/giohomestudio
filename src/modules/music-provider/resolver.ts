// GioHomeStudio — Music Provider Resolver
// Selects the active provider based on env config.
// Falls back to stock_library if active provider fails or is unavailable.

import { env } from "@/config/env";
import { providerConfig } from "@/config/providers";
import { getMusicProvider } from "./registry";
import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";

export async function resolveAndGenerateMusic(
  input: MusicGenerationInput,
  preferredProvider?: string
): Promise<MusicGenerationOutput> {
  const providerName = preferredProvider ?? env.music.provider ?? providerConfig.music.fallback;

  let provider: IMusicProvider | undefined = getMusicProvider(providerName);

  if (!provider) {
    console.warn(`[MusicResolver] Provider "${providerName}" not found. Falling back to: ${providerConfig.music.fallback}`);
    provider = getMusicProvider(providerConfig.music.fallback);
  }

  if (!provider) {
    return {
      status: "failed",
      error: "No music provider available.",
      providerName: providerName,
    };
  }

  const result = await provider.generate(input);

  // If active provider fails, auto-fallback to stock library
  if (result.status === "failed" && provider.name !== providerConfig.music.fallback) {
    console.warn(`[MusicResolver] Provider "${provider.name}" failed. Falling back to stock_library.`);
    const fallback = getMusicProvider(providerConfig.music.fallback);
    if (fallback) {
      return fallback.generate(input);
    }
  }

  return result;
}
