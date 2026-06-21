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
import { falGenerateImage, downloadFalMedia, uploadImageToFal } from "../gateways/fal";
import { kieGenerateImage } from "../gateways/kie";
import { writeMedia } from "@/lib/storage/writeMedia";

// Cache: "local /api/media/ URL @ file mtime" → FAL CDN public URL
// Phase D fix (2026-05-22): cache key was URL-only. When user regenerates a portrait
// at the same path, the local URL stays identical but the disk content changes →
// cache returned the OLD CDN URL → scenes used the OLD portrait. The "substitution
// doesn't switch" bug. Including mtime in the cache key forces a fresh upload when
// the underlying file changes.
const _portraitCdnCache = new Map<string, string>();

async function resolvePublicPortraitUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (!url.startsWith("/api/media/")) return null;
  try {
    const relative = url.replace("/api/media/", "");
    const storageRoot = path.resolve(process.env.STORAGE_BASE_PATH ?? "./storage");
    const filePath = path.resolve(storageRoot, relative);
    if (!fs.existsSync(filePath)) return null;
    // Include mtime in cache key so regenerated portraits invalidate the cache
    const stat = fs.statSync(filePath);
    const cacheKey = `${url}@${stat.mtimeMs}@${stat.size}`;
    const cached = _portraitCdnCache.get(cacheKey);
    if (cached) return cached;
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const cdnUrl = await uploadImageToFal(buffer, mimeType);
    _portraitCdnCache.set(cacheKey, cdnUrl);
    console.log(`[ImageProvider] Portrait → FAL CDN: ${relative} (mtime=${stat.mtimeMs}) → ${cdnUrl}`);
    return cdnUrl;
  } catch (e) {
    console.warn(`[ImageProvider] Portrait upload failed: ${e}`);
    return null;
  }
}

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
  // Route to face-lock model when caller requests identity preservation.
  // Override the user's model UNLESS they specifically picked a non-FLUX model
  // (e.g., Ideogram for transparent BG) — those choices win.
  let effectiveModelId = req.modelId;
  const userPickedNonFlux = !!req.modelId && !req.modelId.toLowerCase().includes("flux");
  if (req.useIdentityLock && req.referenceImageUrl && !userPickedNonFlux) {
    effectiveModelId = "fal_flux_pulid";
    console.log(`[ImageProvider] Identity lock → fal_flux_pulid (was: ${req.modelId || "default"})`);
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
    // For PuLID: upload local portrait to FAL CDN so FAL can access it
    if (req.referenceImageUrl && model.id === "fal_flux_pulid") {
      const publicUrl = await resolvePublicPortraitUrl(req.referenceImageUrl);
      if (publicUrl) {
        falParams.face_image_url = publicUrl;
      } else {
        console.warn(`[ImageProvider] PuLID: portrait not resolvable — identity lock skipped`);
      }
    }
    const result = await falGenerateImage(falParams);
    if (!result.success) {
      console.warn(`[ImageProvider] FAL failed (${result.error}) — falling back to Segmind p-image`);
      const segResult = await segmindGenerateImage({ endpoint: "p-image", prompt: req.prompt, negativePrompt: req.negativePrompt, width: req.width, height: req.height, seed: req.seed });
      if (segResult.success) imageBuffer = segResult.data;
      else console.warn(`[ImageProvider] FAL+Segmind failed (${result.error} | ${segResult.error}) — trying free Pollinations`);
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
      if (falResult.success && falResult.imageUrl) imageBuffer = await downloadFalMedia(falResult.imageUrl);
      else console.warn(`[ImageProvider] Segmind+FAL failed — trying free Pollinations`);
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
      if (falResult.success && falResult.imageUrl) imageBuffer = await downloadFalMedia(falResult.imageUrl);
      else console.warn(`[ImageProvider] Kie+FAL failed — trying free Pollinations`);
    } else {
      imageBuffer = result.data;
    }
  }

  // FREE fallback — Pollinations.ai (no key/credits) so planners keep generating at $0 balance (Henry 2026-06-21).
  if (!imageBuffer) {
    try {
      const w = req.width || 1024, h = req.height || 1024;
      const purl = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.prompt)}?width=${w}&height=${h}&nologo=true&model=flux${req.seed ? `&seed=${req.seed}` : ""}`;
      const pres = await fetch(purl, { signal: AbortSignal.timeout(120_000) });
      if (pres.ok && (pres.headers.get("content-type") || "").startsWith("image/")) {
        const ab = await pres.arrayBuffer();
        if (ab.byteLength > 1000) { imageBuffer = Buffer.from(ab); console.log("[ImageProvider] Pollinations free fallback OK"); }
      }
    } catch (e) { console.warn("[ImageProvider] Pollinations fallback failed:", e); }
  }

  if (!imageBuffer) return { success: false, error: "No image data returned (all providers incl. free Pollinations failed)", model };

  // Save to file if outputPath provided — routed through the storage abstraction
  // (Task #5 R2 cutover). STORAGE_PROVIDER unset = byte-identical local write
  // (LocalFsProvider writes the same path); STORAGE_PROVIDER=r2 lands in R2.
  let imagePath: string | undefined;
  if (req.outputPath) {
    await writeMedia(req.outputPath, imageBuffer);
    imagePath = req.outputPath;
  }

  return { success: true, imagePath, imageUrl, imageBuffer, model };
}
