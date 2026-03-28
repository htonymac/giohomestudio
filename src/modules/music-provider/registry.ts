// GioHomeStudio — Music Provider Registry
// Register all available music providers here.
// The resolver reads from this registry.

import type { IMusicProvider } from "@/types/providers";
import { stockLibraryMusicProvider } from "./providers/stock-library.adapter";
import { kieAiMusicProvider } from "./providers/kie-ai.adapter";
import { mockMusicProvider } from "./providers/mock-music.adapter";

const musicProviders: Map<string, IMusicProvider> = new Map([
  [stockLibraryMusicProvider.name, stockLibraryMusicProvider],
  [kieAiMusicProvider.name, kieAiMusicProvider],
  [mockMusicProvider.name, mockMusicProvider],
  // Add more providers here:
  // [mubertProvider.name, mubertProvider],
  // [stableAudioProvider.name, stableAudioProvider],
]);

export function getMusicProvider(name: string): IMusicProvider | undefined {
  return musicProviders.get(name);
}

export function listMusicProviders(): string[] {
  return Array.from(musicProviders.keys());
}

export function registerMusicProvider(provider: IMusicProvider): void {
  musicProviders.set(provider.name, provider);
}
