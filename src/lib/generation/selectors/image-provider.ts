// GioHomeStudio — Image Provider Selector
// Routes image generation requests to the correct gateway based on model registry.

import * as fs from "fs";
import * as path from "path";
import { getModelById, getDefaultImageModel, type ModelEntry } from "../model-registry";
import { segmindGenerateImage } from "../gateways/segmind";
import { falGenerateImage, downloadFalMedia } from "../gateways/fal";

export interface ImageGenerateRequest {
  modelId?: string;       // registry model ID — uses default if not set
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  outputPath?: string;    // if set, saves to this path and returns it
}

export interface ImageGenerateResult {
  success: boolean;
  imagePath?: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
  model: ModelEntry;
  error?: string;
}

export async function generateImage(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
  const model = req.modelId ? getModelById(req.modelId) : getDefaultImageModel();
  if (!model) return { success: false, error: `Model not found: ${req.modelId}`, model: getDefaultImageModel() };
  if (!model.is_active) return { success: false, error: `Model ${model.id} is not active`, model };

  console.log(`[ImageProvider] Using ${model.id} (${model.gateway}) for: ${req.prompt.slice(0, 60)}...`);

  let imageBuffer: Buffer | undefined;
  let imageUrl: string | undefined;

  if (model.gateway === "segmind") {
    const result = await segmindGenerateImage({
      endpoint: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
    });
    if (!result.success) return { success: false, error: result.error, model };
    imageBuffer = result.data;
  } else if (model.gateway === "fal") {
    const result = await falGenerateImage({
      endpoint: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
    });
    if (!result.success) return { success: false, error: result.error, model };
    imageUrl = result.imageUrl;
    if (imageUrl) {
      imageBuffer = await downloadFalMedia(imageUrl);
    }
  }

  if (!imageBuffer) return { success: false, error: "No image data returned", model };

  // Save to file if outputPath provided
  let imagePath: string | undefined;
  if (req.outputPath) {
    const dir = path.dirname(req.outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(req.outputPath, imageBuffer);
    imagePath = req.outputPath;
  }

  return { success: true, imagePath, imageUrl, imageBuffer, model };
}
