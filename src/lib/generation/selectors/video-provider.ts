// GioHomeStudio — Video Provider Selector
// Routes video generation requests to the correct gateway based on model registry.

import * as fs from "fs";
import * as path from "path";
import { getModelById, getDefaultVideoModel, type ModelEntry } from "../model-registry";
import { segmindGenerateVideo } from "../gateways/segmind";
import { falGenerateVideo, downloadFalMedia } from "../gateways/fal";
import { writeMedia } from "@/lib/storage/writeMedia";

export interface VideoGenerateRequest {
  modelId?: string;
  prompt: string;
  negativePrompt?: string;
  duration?: number;      // seconds
  imageUrl?: string;      // for image-to-video
  seed?: number;
  outputPath?: string;
}

export interface VideoGenerateResult {
  success: boolean;
  videoPath?: string;
  videoUrl?: string;
  videoBuffer?: Buffer;
  model: ModelEntry;
  error?: string;
}

export async function generateVideo(req: VideoGenerateRequest): Promise<VideoGenerateResult> {
  const model = req.modelId ? getModelById(req.modelId) : getDefaultVideoModel();
  if (!model) return { success: false, error: `Model not found: ${req.modelId}`, model: getDefaultVideoModel() };
  if (!model.is_active) return { success: false, error: `Model ${model.id} is not active`, model };

  console.log(`[VideoProvider] Using ${model.id} (${model.gateway}) for: ${req.prompt.slice(0, 60)}...`);

  let videoBuffer: Buffer | undefined;
  let videoUrl: string | undefined;

  if (model.gateway === "segmind") {
    const result = await segmindGenerateVideo({
      endpoint: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      duration: req.duration,
      image: req.imageUrl, // Segmind may accept base64 or URL
      seed: req.seed,
    });
    if (!result.success) return { success: false, error: result.error, model };
    videoBuffer = result.data;
  } else if (model.gateway === "fal") {
    const result = await falGenerateVideo({
      endpoint: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      duration: req.duration,
      imageUrl: req.imageUrl,
      seed: req.seed,
    });
    if (!result.success) return { success: false, error: result.error, model };
    videoUrl = result.videoUrl;
    if (videoUrl) {
      videoBuffer = await downloadFalMedia(videoUrl);
    }
  }

  if (!videoBuffer) return { success: false, error: "No video data returned", model };

  // Routed through the storage abstraction (Task #5). Flag-off = identical local write.
  let videoPath: string | undefined;
  if (req.outputPath) {
    await writeMedia(req.outputPath, videoBuffer);
    videoPath = req.outputPath;
  }

  return { success: true, videoPath, videoUrl, videoBuffer, model };
}
