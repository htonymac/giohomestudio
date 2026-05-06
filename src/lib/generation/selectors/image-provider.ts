// GioHomeStudio — Image Provider Selector
// Routes image generation requests to the correct gateway based on model registry.
// Character consistency is handled via detailed prompt engineering (character description
// placed FIRST in the prompt, with identity lock repeated at end).
// p-image-edit requires public image_urls which are not available server-side —
// so we use p-image (text-to-image) with richly structured character prompts.

import * as fs from "fs";
import * as path from "path";
import { getModelById, getDefaultImageModel, type ModelEntry } from "../model-registry";
import { segmindGenerateImage } from "../gateways/segmind";
import { falGenerateImage, downloadFalMedia } from "../gateways/fal";
import { kieGenerateImage } from "../gateways/kie";

export interface ImageGenerateRequest {
  modelId?: string;       // registry model ID — uses default if not set
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  outputPath?: string;    // if set, saves to this path and returns it
  referenceImageUrl?: string;  // character reference image URL
  useIdentityLock?: boolean;   // true = route to fal_flux_pulid for face preservation
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
  // Route to face-lock model when caller requests identity preservation
  let effectiveModelId = req.modelId;
  if (req.useIdentityLock && req.referenceImageUrl && !req.modelId) {
    effectiveModelId = "fal_flux_pulid";
    console.log(`[ImageProvider] Identity lock requested — routing to fal_flux_pulid`);
  }

  const model = effectiveModelId ? getModelById(effectiveModelId) : getDefaultImageModel();
  if (!model) return { success: false, error: `Model not found: ${effectiveModelId}`, model: getDefaultImageModel() };
  if (!model.is_active) return { success: false, error: `Model ${model.id} is not active`, model };

  console.log(`[ImageProvider] Using ${model.id} (${model.gateway}/${model.endpoint_id}) for: ${req.prompt.slice(0, 80)}...`);

  let imageBuffer: Buffer | undefined;
  let imageUrl: string | undefined;

  if (model.gateway === "fal") {
    // PuLID face-lock: needs reference image forwarded to API
    const falParams: Parameters<typeof falGenerateImage>[0] = {
      endpoint: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
    };
    // Forward reference image for PuLID and any other identity-capable endpoints
    if (req.referenceImageUrl && model.id === "fal_flux_pulid") {
      (falParams as unknown as Record<string, unknown>).reference_image_url = req.referenceImageUrl;
    }
    const result = await falGenerateImage(falParams);
    if (!result.success) {
      console.warn(`[ImageProvider] FAL failed (${result.error}) — falling back to Segmind p-image`);
      const segResult = await segmindGenerateImage({ endpoint: "p-image", prompt: req.prompt, negativePrompt: req.negativePrompt, width: req.width, height: req.height, seed: req.seed });
      if (!segResult.success) return { success: false, error: `FAL: ${result.error} | Segmind fallback: ${segResult.error}`, model };
      imageBuffer = segResult.data;
    } else {
      imageUrl = result.imageUrl;
      if (imageUrl) imageBuffer = await downloadFalMedia(imageUrl);
    }
  } else if (model.gateway === "segmind") {
    // Use p-image (text-to-image). Character consistency enforced by:
    // 1. Character description placed FIRST in prompt
    // 2. [CHARACTER LOCK] identity block repeated at end
    const result = await segmindGenerateImage({
      endpoint: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
    });
    if (!result.success) {
      // Segmind failed — fall back to FAL flux/schnell
      console.warn(`[ImageProvider] Segmind failed (${result.error}) — falling back to FAL flux/schnell`);
      const falResult = await falGenerateImage({ endpoint: "fal-ai/flux/schnell", prompt: req.prompt, negativePrompt: req.negativePrompt, width: req.width, height: req.height, seed: req.seed });
      if (!falResult.success) return { success: false, error: falResult.error, model };
      if (falResult.imageUrl) imageBuffer = await downloadFalMedia(falResult.imageUrl);
    } else {
      imageBuffer = result.data;
    }
  } else if (model.gateway === "kie") {
    const result = await kieGenerateImage({
      endpoint_id: model.endpoint_id,
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      width: req.width,
      height: req.height,
      seed: req.seed,
    });
    if (!result.success) {
      // Kie failed — fall back to FAL flux/schnell
      console.warn(`[ImageProvider] Kie failed (${result.error}) — falling back to FAL flux/schnell`);
      const falResult = await falGenerateImage({ endpoint: "fal-ai/flux/schnell", prompt: req.prompt, negativePrompt: req.negativePrompt, width: req.width, height: req.height, seed: req.seed });
      if (!falResult.success) return { success: false, error: `Kie: ${result.error} | FAL fallback: ${falResult.error}`, model };
      if (falResult.imageUrl) imageBuffer = await downloadFalMedia(falResult.imageUrl);
    } else {
      imageBuffer = result.data;
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
