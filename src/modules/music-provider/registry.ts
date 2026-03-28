// GioHomeStudio — Music Provider Registry
// Register all available music providers here.
// The resolver reads from this registry.

import type { IMusicProvider } from "@/types/providers";
import { stockLibraryMusicProvider } from "./providers/stock-library.adapter";
import { mockMusicProvider } from "./providers/mock-music.adapter";
import { kieAiMusicProvider } from "./providers/kie-ai.adapter";
import { jamendoMusicProvider } from "./providers/jamendo.adapter";
import { freesoundProvider } from "./providers/freesound.adapter";

// Provider priority (highest first when resolving by mood):
//   jamendo → stock_library → mock_music
//
// Generation providers (async, when configured):
//   kie_ai → mubert (future)
//
// Ambience layer (future, separate from main music):
//   freesound

const musicProviders: Map<string, IMusicProvider> = new Map([
  [stockLibraryMusicProvider.name, stockLibraryMusicProvider],
  [mockMusicProvider.name, mockMusicProvider],
  [kieAiMusicProvider.name, kieAiMusicProvider],
  [jamendoMusicProvider.name, jamendoMusicProvider],
  [freesoundProvider.name, freesoundProvider],
  // Future:
  // [mubertProvider.name, mubertProvider],
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
