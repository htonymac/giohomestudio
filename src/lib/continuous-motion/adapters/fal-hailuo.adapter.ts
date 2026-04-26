// GioHomeStudio — Hailuo / MiniMax Video Adapter (via fal.ai)
// Implements VideoProviderAdapter for Hailuo text-to-video and image-to-video.
// Reuses the existing fal.ts gateway — no direct axios calls here.
//
// NOTE: Hailuo (MiniMax) does NOT support seed — continuity relies on anchor frame only.
// NOTE: maxDuration is 6s per segment — shorter clips, more transitions needed for long scenes.
// NOTE: costPerSecond is $0.10 — higher cost, cinematic quality.

import { falGenerateVideo } from "../../generation/gateways/fal";
import type {
  VideoAdapterCapabilities,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "../provider-router";

// fal.ai endpoint identifiers for Hailuo (MiniMax)
const HAILUO_T2V_ENDPOINT = "fal-ai/minimax/video-01-text-to-video";
const HAILUO_I2V_ENDPOINT = "fal-ai/minimax/video-01-image-to-video";

export class FalHailuoAdapter implements VideoProviderAdapter {
  /**
   * Generate a video from a text prompt (first segment — no anchor image).
   * Returns { videoUrl, jobId, actualDuration }.
   * NOTE: seed is ignored for Hailuo — provider does not support it.
   */
  async generateFromText(
    prompt: string,
    _seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult> {
    const result = await falGenerateVideo(
      {
        endpoint: HAILUO_T2V_ENDPOINT,
        prompt,
        seed: undefined, // Hailuo does not support seed
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[hailuo-t2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Hailuo T2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `hailuo-t2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Generate a video from a starting image + continuation prompt.
   * Used for all segments after the first — passes the anchor frame as imageUrl.
   * NOTE: seed is ignored for Hailuo — provider does not support it.
   */
  async generateFromImage(
    imageUrl: string,
    prompt: string,
    _seed: number | undefined,
    durationSeconds: number
  ): Promise<VideoGenerationResult> {
    const result = await falGenerateVideo(
      {
        endpoint: HAILUO_I2V_ENDPOINT,
        prompt,
        imageUrl,
        seed: undefined, // Hailuo does not support seed
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[hailuo-i2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Hailuo I2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `hailuo-i2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Static capabilities for cost estimation and UI display.
   * maxDuration: 6s per segment (Hailuo MiniMax limit).
   * supportsSeed: false — no seed control, rely on anchor frames for continuity.
   * costPerSecond: $0.10 — higher cost than Kling/Wan.
   */
  getCapabilities(): VideoAdapterCapabilities {
    return {
      name: "Hailuo MiniMax",
      maxDuration: 6,
      supportsSeed: false,
      supportsImageInput: true,
      costPerSecond: 0.10,
      quality: "standard",
    };
  }
}
