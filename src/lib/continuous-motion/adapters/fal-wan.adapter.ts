// GioHomeStudio — Wan 2.5 Adapter (via fal.ai)
// Implements VideoProviderAdapter for Wan text-to-video and image-to-video.
// Reuses the existing fal.ts gateway — no direct axios calls here.
// Endpoints verified against app/api/video/generate/route.ts (source of truth).

import { falGenerateVideo } from "../../generation/gateways/fal";
import type {
  VideoAdapterCapabilities,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "../provider-router";

// fal.ai endpoint identifiers for Wan 2.5
const WAN_T2V_ENDPOINT = "fal-ai/wan/v2.5/text-to-video";
const WAN_I2V_ENDPOINT = "fal-ai/wan/v2.5/image-to-video";

export class FalWanAdapter implements VideoProviderAdapter {
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
        endpoint: WAN_T2V_ENDPOINT,
        prompt,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[wan-t2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Wan T2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `wan-t2v-${Date.now()}`,
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
        endpoint: WAN_I2V_ENDPOINT,
        prompt,
        imageUrl,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[wan-i2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Wan I2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `wan-i2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Static capabilities for cost estimation and UI display.
   * maxDuration: Wan Pro generates up to 10s comfortably; 5s recommended for continuity.
   */
  getCapabilities(): VideoAdapterCapabilities {
    return {
      name: "Wan 2.5",
      maxDuration: 10,
      supportsSeed: true,
      supportsImageInput: true,
      costPerSecond: 0.07,
      quality: "standard",
    };
  }
}
