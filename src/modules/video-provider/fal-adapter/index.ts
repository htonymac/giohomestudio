// GioHomeStudio — fal.ai Video Provider Adapter
// Wraps the fal gateway to implement IVideoProvider interface.
// Uses queue-based async: submit → poll → download.

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { falGenerateVideo, downloadFalMedia, isFalConfigured } from "@/lib/generation/gateways/fal";
import { getDefaultVideoModel, getModelById } from "@/lib/generation/model-registry";
import type { IVideoProvider, VideoGenerationInput, VideoGenerationOutput } from "@/types/providers";

const results = new Map<string, { videoUrl?: string; videoPath?: string; error?: string }>();

class FalVideoAdapter implements IVideoProvider {
  readonly name = "fal_video";

  async generate(input: VideoGenerationInput): Promise<VideoGenerationOutput> {
    if (!await isFalConfigured()) {
      return { jobId: "", status: "failed", error: "FAL_KEY not configured" };
    }

    const model = getDefaultVideoModel();
    const jobId = `fal_${Date.now()}`;

    const result = await falGenerateVideo({
      endpoint: model.endpoint_id,
      prompt: input.prompt,
      duration: input.durationSeconds,
      imageUrl: input.referenceImageUrl,
    });

    if (!result.success) {
      results.set(jobId, { error: result.error });
      return { jobId, status: "failed", error: result.error };
    }

    if (result.videoUrl) {
      const outputPath = path.join(env.storagePath, "video", `${jobId}.mp4`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buf = await downloadFalMedia(result.videoUrl);
      fs.writeFileSync(outputPath, buf);
      results.set(jobId, { videoUrl: result.videoUrl, videoPath: outputPath });
      return { jobId, status: "completed", videoUrl: result.videoUrl, localPath: outputPath };
    }

    results.set(jobId, { error: "No video URL in response" });
    return { jobId, status: "failed", error: "No video URL in response" };
  }

  async checkStatus(jobId: string): Promise<VideoGenerationOutput> {
    const r = results.get(jobId);
    if (!r) return { jobId, status: "failed", error: "Job not found" };
    if (r.error) return { jobId, status: "failed", error: r.error };
    return { jobId, status: "completed", videoUrl: r.videoUrl, localPath: r.videoPath };
  }

  async download(jobId: string, outputPath: string): Promise<string> {
    const r = results.get(jobId);
    if (r?.videoPath && r.videoPath !== outputPath) {
      fs.copyFileSync(r.videoPath, outputPath);
    }
    return outputPath;
  }
}

export const falVideoAdapter: IVideoProvider = new FalVideoAdapter();
