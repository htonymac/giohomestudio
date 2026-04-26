// GioHomeStudio — Segmind Video Provider Adapter
// Wraps the Segmind gateway to implement IVideoProvider interface
// so it works with the existing pipeline.

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { segmindGenerateVideo, isSegmindConfigured } from "@/lib/generation/gateways/segmind";
import type { IVideoProvider, VideoGenerationInput, VideoGenerationOutput } from "@/types/providers";

// Store results keyed by fake job IDs (Segmind is synchronous)
const results = new Map<string, { videoPath?: string; error?: string }>();

class SegmindVideoAdapter implements IVideoProvider {
  readonly name = "segmind_video";

  async generate(input: VideoGenerationInput): Promise<VideoGenerationOutput> {
    if (!await isSegmindConfigured()) {
      return { jobId: "", status: "failed", error: "SEGMIND_API_KEY not configured" };
    }

    const jobId = `segmind_${Date.now()}`;
    const outputPath = path.join(env.storagePath, "video", `${jobId}.mp4`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const result = await segmindGenerateVideo({
      endpoint: "p-video",
      prompt: input.prompt,
      duration: input.durationSeconds ?? 5,
      image: input.referenceImageUrl,
    });

    if (!result.success || !result.data) {
      results.set(jobId, { error: result.error });
      return { jobId, status: "failed", error: result.error };
    }

    fs.writeFileSync(outputPath, result.data);
    results.set(jobId, { videoPath: outputPath });
    return { jobId, status: "completed", videoUrl: outputPath, localPath: outputPath };
  }

  async checkStatus(jobId: string): Promise<VideoGenerationOutput> {
    const r = results.get(jobId);
    if (!r) return { jobId, status: "failed", error: "Job not found" };
    if (r.error) return { jobId, status: "failed", error: r.error };
    return { jobId, status: "completed", localPath: r.videoPath };
  }

  async download(jobId: string, outputPath: string): Promise<string> {
    const r = results.get(jobId);
    if (r?.videoPath && r.videoPath !== outputPath) {
      fs.copyFileSync(r.videoPath, outputPath);
    }
    return outputPath;
  }
}

export const segmindVideoAdapter: IVideoProvider = new SegmindVideoAdapter();
