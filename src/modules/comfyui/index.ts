// GioHomeStudio — ComfyUI client for Flux.1 character image generation
// Talks to the local ComfyUI REST API (default: http://127.0.0.1:8188)

import { env } from "@/config/env";

const BASE = env.comfyui.url;

// ── Angle metadata ─────────────────────────────────────────────────────────

const ANGLE_DIMS: Record<string, { w: number; h: number }> = {
  front:               { w: 832, h: 1216 },
  three_quarter_left:  { w: 832, h: 1216 },
  three_quarter_right: { w: 832, h: 1216 },
  profile:             { w: 832, h: 1216 },
  full_body_front:     { w: 768, h: 1344 },
};

const ANGLE_SUFFIX: Record<string, string> = {
  front:               "front facing portrait, looking directly at camera, both eyes fully visible, centered composition",
  three_quarter_left:  "three-quarter view, face turned 45 degrees to the left, natural relaxed pose",
  three_quarter_right: "three-quarter view, face turned 45 degrees to the right, natural relaxed pose",
  profile:             "perfect side profile view, face turned 90 degrees, one eye visible",
  full_body_front:     "full body shot, standing upright, facing camera directly, head to toe in frame",
};

// ── Workflow node IDs ──────────────────────────────────────────────────────
// Keyed by role so poll logic doesn't rely on magic strings.

const NODE = {
  checkpoint:     "1",
  positivePrompt: "2",
  negativePrompt: "3",
  emptyLatent:    "4",
  sampler:        "5",
  vaeDecoder:     "6",
  saveImage:      "7",
} as const;

// ── Workflow builder ───────────────────────────────────────────────────────

function buildWorkflow(
  prompt: string,
  width: number,
  height: number,
  seed: number
): Record<string, unknown> {
  return {
    [NODE.checkpoint]: {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: env.comfyui.model },
    },
    [NODE.positivePrompt]: {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: [NODE.checkpoint, 1] },
    },
    [NODE.negativePrompt]: {
      class_type: "CLIPTextEncode",
      inputs: { text: "", clip: [NODE.checkpoint, 1] },
    },
    [NODE.emptyLatent]: {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    [NODE.sampler]: {
      class_type: "KSampler",
      inputs: {
        model:        [NODE.checkpoint,     0],
        positive:     [NODE.positivePrompt, 0],
        negative:     [NODE.negativePrompt, 0],
        latent_image: [NODE.emptyLatent,    0],
        seed,
        steps:        env.comfyui.steps,
        cfg:          1.0,
        sampler_name: "euler",
        scheduler:    "simple",
        denoise:      1.0,
      },
    },
    [NODE.vaeDecoder]: {
      class_type: "VAEDecode",
      inputs: { samples: [NODE.sampler, 0], vae: [NODE.checkpoint, 2] },
    },
    [NODE.saveImage]: {
      class_type: "SaveImage",
      inputs: { images: [NODE.vaeDecoder, 0], filename_prefix: "gio_char_" },
    },
  };
}

// ── Aspect ratio → scene dimensions ───────────────────────────────────────
// Flux.1 optimal bucket sizes for cinematic scene images

const SCENE_DIMS: Record<string, { w: number; h: number }> = {
  "9:16": { w: 832, h: 1472 },
  "16:9": { w: 1216, h: 832 },
  "1:1":  { w: 1024, h: 1024 },
};

// ── Health check ──────────────────────────────────────────────────────────

export async function isComfyUIOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/system_stats`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface GenerateImageResult {
  imageBuffer: Buffer;
}

// General-purpose scene image — cinematic frame for a beat's imagePrompt.
// Used by the images_audio pipeline mode.
export async function generateSceneImage(opts: {
  prompt: string;
  aspectRatio?: string;
  seed?: number;
}): Promise<GenerateImageResult> {
  const { w, h } = SCENE_DIMS[opts.aspectRatio ?? "9:16"] ?? SCENE_DIMS["9:16"];
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);

  const fullPrompt = [
    opts.prompt,
    "cinematic scene, highly detailed, dramatic lighting, photorealistic, 8k",
  ].join(", ");

  return submitAndDownload(fullPrompt, w, h, seed);
}

// ── Shared submit → poll → download ───────────────────────────────────────

type HistoryEntry = {
  outputs: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
  status:  { completed: boolean };
};

async function submitAndDownload(
  fullPrompt: string,
  w: number,
  h: number,
  seed: number
): Promise<GenerateImageResult> {
  const workflow = buildWorkflow(fullPrompt, w, h, seed);

  const submitRes = await fetch(`${BASE}/prompt`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ prompt: workflow }),
  });
  if (!submitRes.ok) {
    throw new Error(`ComfyUI submit failed (${submitRes.status}): ${await submitRes.text()}`);
  }
  const { prompt_id } = (await submitRes.json()) as { prompt_id: string };

  const deadline = Date.now() + 180_000;
  let imageInfo: { filename: string; subfolder: string } | null = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const histRes = await fetch(`${BASE}/history/${prompt_id}`);
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<string, HistoryEntry>;
    const entry = hist[prompt_id];
    if (!entry?.status.completed) continue;
    const images = entry.outputs[NODE.saveImage]?.images;
    if (images?.length) {
      imageInfo = { filename: images[0].filename, subfolder: images[0].subfolder };
      break;
    }
  }

  if (!imageInfo) throw new Error("ComfyUI generation timed out (3 min)");

  const viewUrl = `${BASE}/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(imageInfo.subfolder)}&type=output`;
  const imgRes  = await fetch(viewUrl);
  if (!imgRes.ok) throw new Error(`ComfyUI image download failed (${imgRes.status})`);

  return { imageBuffer: Buffer.from(await imgRes.arrayBuffer()) };
}

export async function generateCharacterImage(opts: {
  characterDescription: string;
  angle: string;
  seed?: number;
}): Promise<GenerateImageResult> {
  const { w, h } = ANGLE_DIMS[opts.angle] ?? ANGLE_DIMS.front;
  const suffix   = ANGLE_SUFFIX[opts.angle] ?? "";
  const seed     = opts.seed ?? Math.floor(Math.random() * 2 ** 32);

  const fullPrompt = [
    opts.characterDescription,
    suffix,
    "highly detailed, professional photography, sharp focus, studio lighting, 8k resolution",
  ].join(", ");

  return submitAndDownload(fullPrompt, w, h, seed);
}
