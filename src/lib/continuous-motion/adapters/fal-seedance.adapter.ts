// GioHomeStudio — Seedance 2.0 (ByteDance) Adapter (via fal.ai)
// Implements VideoProviderAdapter for Seedance text-to-video and image-to-video.
// Reuses the existing fal.ts gateway — no direct axios calls here.
//
// NOTE: Seedance 2.0 supports seed and image input.
// NOTE: costPerSecond is $0.052 — second cheapest after Runway.
// NOTE: Verify endpoints at https://fal.ai/models?q=seedance if naming changes.

import { falGenerateVideo } from "../../generation/gateways/fal";
import type {
  VideoAdapterCapabilities,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "../provider-router";

// fal.ai endpoint identifiers for Seedance 2.0 (ByteDance)
const SEEDANCE_T2V_ENDPOINT = "fal-ai/bytedance/seedance-2.0/text-to-video";
const SEEDANCE_I2V_ENDPOINT = "fal-ai/bytedance/seedance-2.0/image-to-video";

export class FalSeedanceAdapter implements VideoProviderAdapter {
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
        endpoint: SEEDANCE_T2V_ENDPOINT,
        prompt,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[seedance-t2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Seedance T2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `seedance-t2v-${Date.now()}`,
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
        endpoint: SEEDANCE_I2V_ENDPOINT,
        prompt,
        imageUrl,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[seedance-i2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Seedance I2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `seedance-i2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Static capabilities for cost estimation and UI display.
   * maxDuration: 8s per segment (Seedance 2.0 comfortable limit).
   * costPerSecond: $0.052 — very competitive pricing, high quality output.
   * quality: "high" — ByteDance's flagship video model.
   */
  getCapabilities(): VideoAdapterCapabilities {
    return {
      name: "Seedance 2.0",
      maxDuration: 8,
      supportsSeed: true,
      supportsImageInput: true,
      costPerSecond: 0.052,
      quality: "high",
    };
  }
}
