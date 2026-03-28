// GioHomeStudio — Music Provider Interface
// The pipeline only ever talks to this interface — never to a specific provider.
// Swap providers via env or registry without touching pipeline logic.
export type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";
