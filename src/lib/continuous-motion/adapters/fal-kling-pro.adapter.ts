// GioHomeStudio — Kling 2.5 Turbo Pro / Kling 3.0 Pro Adapter (via fal.ai)
// Implements VideoProviderAdapter for Kling Pro text-to-video and image-to-video.
// Reuses the existing fal.ts gateway — no direct axios calls here.
//
// NOTE: Kling Pro requires duration as STRING ("5" or "10") — handled inside fal.ts gateway.
// NOTE: Kling Pro requires active credits on the FAL account — see fal.ai dashboard.
// NOTE: Primary = v2.5/turbo/pro (Kling 2.5 Turbo Pro, ~$0.35/5s).
//       Fallback = v2/master = "Kling 3.0 Pro" tier (~$0.50/5s) — same fal.ai path.
//       Endpoints verified against app/api/video/generate/route.ts (source of truth):
//         kling25-turbo → fal-ai/kling-video/v2.5/turbo/pro/text-to-video
//         kling3-pro    → fal-ai/kling-video/v2/master/text-to-video (fallback tier)

import { falGenerateVideo } from "../../generation/gateways/fal";
import type {
  VideoAdapterCapabilities,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "../provider-router";

// fal.ai endpoint identifiers for Kling 2.5 Turbo Pro (primary)
const KLING_PRO_T2V_ENDPOINT = "fal-ai/kling-video/v2.5/turbo/pro/text-to-video";
const KLING_PRO_I2V_ENDPOINT = "fal-ai/kling-video/v2.5/turbo/pro/image-to-video";
// Kling 3.0 Pro / v2 Master fallback — used by kling3-pro model route
export const KLING_MASTER_T2V_ENDPOINT = "fal-ai/kling-video/v2/master/text-to-video";
export const KLING_MASTER_I2V_ENDPOINT = "fal-ai/kling-video/v2/master/image-to-video";

export class FalKlingProAdapter implements VideoProviderAdapter {
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
        endpoint: KLING_PRO_T2V_ENDPOINT,
        prompt,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[kling-pro-t2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Kling Pro T2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `kling-pro-t2v-${Date.now()}`,
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
        endpoint: KLING_PRO_I2V_ENDPOINT,
        prompt,
        imageUrl,
        seed: seed ?? undefined,
        duration: durationSeconds,
      },
      (event) => {
        console.log(`[kling-pro-i2v] ${event.status} ${event.percent}% — ${event.message}`);
      }
    );

    if (!result.success || !result.videoUrl) {
      throw new Error(
        `Kling Pro I2V generation failed: ${result.error ?? "no video URL returned"}`
      );
    }

    return {
      videoUrl: result.videoUrl,
      jobId: result.requestId ?? `kling-pro-i2v-${Date.now()}`,
      actualDuration: durationSeconds,
    };
  }

  /**
   * Static capabilities for cost estimation and UI display.
   * maxDuration: Kling Pro accepts up to 10s — 5s recommended for continuity.
   * costPerSecond: $0.07/s — same as standard tier per current fal.ai pricing.
   * quality: "premium" — Kling Pro produces higher fidelity than Standard.
   */
  getCapabilities(): VideoAdapterCapabilities {
    return {
      name: "Kling 2.5 Pro",
      maxDuration: 10,
      supportsSeed: true,
      supportsImageInput: true,
      costPerSecond: 0.07,
      quality: "premium",
    };
  }
}
