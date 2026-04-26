// GioHomeStudio — Veo 3.1 (Google) Adapter (via fal.ai)
// Implements VideoProviderAdapter for Veo text-to-video and image-to-video.
// Reuses the existing fal.ts gateway — no direct axios calls here.
//
// TODO: Veo 3.1 endpoints on fal.ai are not yet confirmed publicly available (as of 2026-04).
//       Paths below are based on fal.ai naming conventions for Google models.
//       If "fal-ai/veo3/text-to-video" returns 404, check https://fal.ai/models?q=veo
//       for the correct versioned path and update the constants below.
//
// NOTE: Veo does NOT support seed — continuity relies on anchor frame only.
// NOTE: costPerSecond is $0.50 — premium Google model, highest cost in the lineup.

import { falGenerateVideo } from "../../generation/gateways/fal";
import type {
  VideoAdapterCapabilities,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "../provider-router";

// fal.ai endpoint identifiers for Veo 3.1 (Google)
// TODO: Verify these paths at https://fal.ai/models when Veo 3.1 becomes publicly available.
//       If unavailable, this adapter will throw FAL_ENDPOINT_UNAVAILABLE and smoke tests skip it.
const VEO_T2V_ENDPOINT = "fal-ai/veo3/text-to-video";
const VEO_I2V_ENDPOINT = "fal-ai/veo3/image-to-video";

export class FalVeoAdapter implements VideoProviderAdapter {
  /**
   * Generate a video from a text prompt (first segment — no anchor image).
   * Returns { videoUrl, jobId, actualDuration }.
   * NOTE: seed is ignored for Veo — provider does not support it.
   */
  async generateFromText(
    prompt: string,
    _seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult> {
    const result = await falGenerateVideo(
      {
        endpoint: VEO_T2V_ENDPOINT,
        prompt,
        seed: undefined, // Veo does not support seed
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[veo-t2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Veo T2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `veo-t2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Generate a video from a starting image + continuation prompt.
   * Used for all segments after the first — passes the anchor frame as imageUrl.
   * NOTE: seed is ignored for Veo — provider does not support it.
   */
  async generateFromImage(
    imageUrl: string,
    prompt: string,
    _seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult> {
    const result = await falGenerateVideo(
      {
        endpoint: VEO_I2V_ENDPOINT,
        prompt,
        imageUrl,
        seed: undefined, // Veo does not support seed
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[veo-i2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Veo I2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `veo-i2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Static capabilities for cost estimation and UI display.
   * maxDuration: 8s per segment (Veo 3.1 comfortable limit).
   * supportsSeed: false — no seed control, rely on anchor frames for continuity.
   * costPerSecond: $0.50 — highest cost, best quality output.
   * quality: "best" — Google's flagship model.
   */
  getCapabilities(): VideoAdapterCapabilities {
    return {
      name: "Veo 3.1",
      maxDuration: 8,
      supportsSeed: false,
      supportsImageInput: true,
      costPerSecond: 0.50,
      quality: "best",
    };
  }
}
