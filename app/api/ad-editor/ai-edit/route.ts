// POST /api/ad-editor/ai-edit
// AI-powered image editing: LLM plans the edit, image engine executes
// Modes: ad, movie, banner, text_to_image
// Returns { outputUrl, editType, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

interface EditRequest {
  mode: "ad" | "movie" | "banner" | "text_to_image";
  prompt: string;
  imageBase64?: string;    // existing image (for edit modes)
  imageMime?: string;
}

// LLM Planner — classifies and enhances the prompt
function planEdit(mode: string, userPrompt: string): { editType: string; enhancedPrompt: string; negativePrompt: string } {
  const modePrompts: Record<string, string> = {
    ad: "Professional product advertisement, clean background, commercial lighting, e-commerce quality, sharp focus, promotional style",
    movie: "Cinematic movie poster, dramatic lighting, bold composition, theatrical, epic atmosphere, high contrast, title space at top",
    banner: "Wide horizontal banner, negative space for text, extended background, website hero image, professional marketing",
    text_to_image: "High quality, professional, detailed, sharp, well-composed",
  };

  const stylePrefix = modePrompts[mode] ?? modePrompts.ad;
  const enhancedPrompt = `${stylePrefix}. ${userPrompt}`;
  const negativePrompt = "blurry, low quality, distorted, watermark, text artifacts, ugly, deformed";

  let editType = "style_transfer";
  const lower = userPrompt.toLowerCase();
  if (lower.includes("remove background") || lower.includes("remove bg")) editType = "bg_remove";
  else if (lower.includes("replace background") || lower.includes("change background")) editType = "bg_replace";
  else if (lower.includes("expand") || lower.includes("outpaint") || lower.includes("wider")) editType = "outpaint";
  else if (lower.includes("upscale") || lower.includes("sharpen") || lower.includes("enhance")) editType = "upscale";
  else if (lower.includes("clean") || lower.includes("remove object")) editType = "inpaint";
  else if (mode === "text_to_image") editType = "generate";

  return { editType, enhancedPrompt, negativePrompt };
}

export async function POST(req: NextRequest) {
  let body: EditRequest;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { mode, prompt, imageBase64, imageMime } = body;
  if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const plan = planEdit(mode, prompt);
  const outDir = path.join(env.storagePath, "ad-editor", "ai-edits");
  fs.mkdirSync(outDir, { recursive: true });

  const FAL_KEY = process.env.FAL_API_KEY;
  const SEGMIND_KEY = process.env.SEGMIND_API_KEY;

  // Text-to-image generation (no source image needed)
  if (plan.editType === "generate" || !imageBase64) {
    if (FAL_KEY) {
      try {
        const res = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: plan.enhancedPrompt,
            image_size: mode === "banner" ? { width: 1920, height: 640 } : { width: 1080, height: 1080 },
            num_inference_steps: 4,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const imgUrl = data.images?.[0]?.url;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            const outPath = path.join(outDir, `gen_${Date.now()}.png`);
            fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
            const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
            return NextResponse.json({
              outputUrl: `/api/media/${relPath}`,
              editType: plan.editType,
              enhancedPrompt: plan.enhancedPrompt,
              provider: "fal_ai",
            });
          }
        }
      } catch (e) { console.warn("[ai-edit] fal.ai gen failed:", e); }
    }

    if (SEGMIND_KEY) {
      try {
        const res = await fetch("https://api.segmind.com/v1/sdxl1.0-txt2img", {
          method: "POST",
          headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: plan.enhancedPrompt, negative_prompt: plan.negativePrompt, samples: 1, width: 1080, height: 1080 }),
        });
        if (res.ok) {
          const outPath = path.join(outDir, `gen_${Date.now()}.png`);
          fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({ outputUrl: `/api/media/${relPath}`, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "segmind" });
        }
      } catch (e) { console.warn("[ai-edit] segmind gen failed:", e); }
    }

    return NextResponse.json({ error: "No image generation provider available. Set FAL_API_KEY or SEGMIND_API_KEY." }, { status: 503 });
  }

  // Image editing (has source image)
  if (FAL_KEY) {
    try {
      const dataUrl = `data:${imageMime ?? "image/png"};base64,${imageBase64}`;
      const res = await fetch("https://queue.fal.run/fal-ai/flux/dev/image-to-image", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: plan.enhancedPrompt,
          image_url: dataUrl,
          strength: 0.65,
          num_inference_steps: 28,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const imgUrl = data.images?.[0]?.url;
        if (imgUrl) {
          const imgRes = await fetch(imgUrl);
          const outPath = path.join(outDir, `edit_${Date.now()}.png`);
          fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({ outputUrl: `/api/media/${relPath}`, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "fal_ai" });
        }
      }
    } catch (e) { console.warn("[ai-edit] fal.ai edit failed:", e); }
  }

  if (SEGMIND_KEY) {
    try {
      const res = await fetch("https://api.segmind.com/v1/sdxl1.0-img2img", {
        method: "POST",
        headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, prompt: plan.enhancedPrompt, negative_prompt: plan.negativePrompt, strength: 0.6, samples: 1 }),
      });
      if (res.ok) {
        const outPath = path.join(outDir, `edit_${Date.now()}.png`);
        fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        return NextResponse.json({ outputUrl: `/api/media/${relPath}`, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "segmind" });
      }
    } catch (e) { console.warn("[ai-edit] segmind edit failed:", e); }
  }

  return NextResponse.json({ error: "No image editing provider available. Set FAL_API_KEY or SEGMIND_API_KEY." }, { status: 503 });
}
