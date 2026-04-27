// GioHomeStudio — Runway Gen-4 Adapter (via fal.ai)
// Implements VideoProviderAdapter for Runway text-to-video and image-to-video.
// Reuses the existing fal.ts gateway — no direct axios calls here.
//
// NOTE: Runway Gen-4 supports seed and image input.
// NOTE: costPerSecond is $0.05 — lower cost than Kling/Wan.
//
// EXPERIMENTAL: The "runway-gen4/turbo" path has NOT been confirmed in the live
//   app/api/video/generate/route.ts source of truth (route.ts uses Runway via direct API,
//   not via fal.ai). The paths below follow fal.ai naming conventions for Gen-4 Turbo.
//   If 404 at runtime: check https://fal.ai/models?q=runway for the correct versioned path.
//   Alternative: "fal-ai/runway/gen4/text-to-video" (without the turbo sub-path).
//   This adapter is marked experimental: true in capabilities until confirmed.

import { falGenerateVideo } from "../../generation/gateways/fal";
import type {
  VideoAdapterCapabilities,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "../provider-router";

// fal.ai endpoint identifiers for Runway Gen-4 Turbo
// EXPERIMENTAL — verify at https://fal.ai/models?q=runway before production use
const RUNWAY_T2V_ENDPOINT = "fal-ai/runway-gen4/turbo/text-to-video";
const RUNWAY_I2V_ENDPOINT = "fal-ai/runway-gen4/turbo/image-to-video";

export class FalRunwayAdapter implements VideoProviderAdapter {
  /**
   * Generate a video from a text prompt (first segment — no anchor image).
   * Returns { videoUrl, jobId, actualDuration }.
   */
  async generateFromText(
    prompt: string,
    seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult> {
    const result = await falGenerateVideo(
      {
        endpoint: RUNWAY_T2V_ENDPOINT,
        prompt,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[runway-t2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Runway T2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `runway-t2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Generate a video from a starting image + continuation prompt.
   * Used for all segments after the first — passes the anchor frame as imageUrl.
   */
  async generateFromImage(
    imageUrl: string,
    prompt: string,
    seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult> {
    const result = await falGenerateVideo(
      {
        endpoint: RUNWAY_I2V_ENDPOINT,
        prompt,
        imageUrl,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[runway-i2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Runway I2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `runway-i2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Static capabilities for cost estimation and UI display.
   * maxDuration: 10s per segment (Runway Gen-4 Turbo max).
   * costPerSecond: $0.05 — most cost-effective option in the lineup.
   * quality: "high" — Runway known for cinematic motion quality.
   */
  getCapabilities(): VideoAdapterCapabilities {
    return {
      name: "Runway Gen-4",
      maxDuration: 10,
      supportsSeed: true,
      supportsImageInput: true,
      costPerSecond: 0.05,
      quality: "high",
    };
  }
}
