// GioHomeStudio — Continuous Motion Provider Router
// Routes provider key strings to the correct video adapter.
// Pure TypeScript. No direct API calls here — just adapter lookup.

import { FalWanAdapter } from "./adapters/fal-wan.adapter";
import { FalKlingAdapter } from "./adapters/fal-kling.adapter";
import { FalKlingProAdapter } from "./adapters/fal-kling-pro.adapter";
import { FalHailuoAdapter } from "./adapters/fal-hailuo.adapter";
import { FalRunwayAdapter } from "./adapters/fal-runway.adapter";
import { FalVeoAdapter } from "./adapters/fal-veo.adapter";
import { FalSeedanceAdapter } from "./adapters/fal-seedance.adapter";

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface VideoAdapterCapabilities {
  name: string;
  maxDuration: number;        // seconds
  supportsSeed: boolean;
  supportsImageInput: boolean;
  costPerSecond: number;      // USD
  quality: "standard" | "pro" | "ultra" | "premium" | "high" | "best";
}

export interface VideoGenerationResult {
  videoUrl: string;
  jobId: string;
  actualDuration?: number;    // seconds, if provider reports it
}

export interface VideoProviderAdapter {
  /** Generate video from text prompt (first segment — no anchor) */
  generateFromText(
    prompt: string,
    seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult>;

  /** Generate video from starting image + prompt (continuation segments) */
  generateFromImage(
    imageUrl: string,
    prompt: string,
    seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult>;

  /** Report provider capabilities for planning/cost estimation */
  getCapabilities(): VideoAdapterCapabilities;
}

// ── Registry ──────────────────────────────────────────────────────────────────

type AdapterConstructor = new () => VideoProviderAdapter;

const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
  wan: FalWanAdapter,
  kling_std: FalKlingAdapter,
  kling_pro: FalKlingProAdapter,
  hailuo: FalHailuoAdapter,
  runway: FalRunwayAdapter,
  veo: FalVeoAdapter,
  seedance: FalSeedanceAdapter,
};

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Returns a fresh adapter instance for the given provider key.
 * Throws if the key is not registered.
 */
export function getAdapter(providerKey: string): VideoProviderAdapter {
  const AdapterClass = ADAPTER_REGISTRY[providerKey];
  if (!AdapterClass) {
    throw new Error(
      `Unknown continuous-motion provider: "${providerKey}". ` +
      `Registered keys: ${Object.keys(ADAPTER_REGISTRY).join(", ")}`
    );
  }
  return new AdapterClass();
}

/**
 * Returns capabilities for every registered provider.
 * Useful for building the UI provider selector.
 */
export function getAllCapabilities(): Record<string, VideoAdapterCapabilities> {
  const result: Record<string, VideoAdapterCapabilities> = {};
  for (const [key, Cls] of Object.entries(ADAPTER_REGISTRY)) {
    result[key] = new Cls().getCapabilities();
  }
  return result;
}

/**
 * Returns only providers that support image input (required for continuation).
 * Providers without supportsImageInput cannot be used for Continuous Motion.
 */
export function getContinuationCapableProviders(): string[] {
  return Object.entries(ADAPTER_REGISTRY)
    .filter(([, Cls]) => new Cls().getCapabilities().supportsImageInput)
    .map(([key]) => key);
}
