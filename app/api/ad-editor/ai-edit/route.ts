// POST /api/ad-editor/ai-edit
// AI-powered image editing: LLM plans the edit, image engine executes
// Modes: ad, movie, banner, text_to_image
// Returns { outputUrl, editType, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";
import { prisma } from "@/lib/prisma";

interface EditRequest {
  mode: "ad" | "movie" | "banner" | "text_to_image";
  prompt: string;
  imageBase64?: string;    // existing image (for edit modes)
  imageMime?: string;
  projectId?: string;      // if provided, track job + asset in DB
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

// Track AI edit job and output asset in DB (fire-and-forget)
async function trackJob(projectId: string, mode: string, editType: string, prompt: string, enhancedPrompt: string, provider: string, outputUrl: string) {
  try {
    const asset = await prisma.adAsset.create({
      data: { projectId, sourceType: editType === "generate" ? "ai_generate" : "ai_edit", currentUrl: outputUrl, metadata: { provider, editType } },
    });
    await prisma.aIEditJob.create({
      data: { projectId, mode, editType, originalPrompt: prompt, enhancedPrompt, provider, outputAssetId: asset.id, outputUrl, status: "COMPLETED", completedAt: new Date() },
    });
  } catch (e) { console.warn("[ai-edit] DB tracking failed:", e); }
}

export async function POST(req: NextRequest) {
  let body: EditRequest;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { mode, prompt, imageBase64, imageMime, projectId } = body;
  if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const plan = planEdit(mode, prompt);
  const outDir = path.join(env.storagePath, "ad-editor", "ai-edits");
  fs.mkdirSync(outDir, { recursive: true });

  const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;  // server uses FAL_KEY (was the regression)
  const SEGMIND_KEY = process.env.SEGMIND_API_KEY;

  // Text-to-image generation (no source image needed)
  if (plan.editType === "generate" || !imageBase64) {
    if (FAL_KEY) {
      try {
        // Migrated to providers/fal adapter (Henry 2026-05-30 task #24).
        const { falFluxSchnell } = await import("@/lib/providers/fal");
        const r = await falFluxSchnell({
          prompt: plan.enhancedPrompt,
          imageSize: mode === "banner" ? { width: 1920, height: 640 } : { width: 1080, height: 1080 },
          numInferenceSteps: 4,
        });
        if (r.ok) {
          const imgUrl = r.data.images?.[0]?.url;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            const outPath = path.join(outDir, `gen_${Date.now()}.png`);
            await writeMedia(outPath, Buffer.from(await imgRes.arrayBuffer()));
            const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
            const outputUrl = `/api/media/${relPath}`;
            if (projectId) trackJob(projectId, mode, plan.editType, prompt, plan.enhancedPrompt, "fal_ai", outputUrl);
            return NextResponse.json({ outputUrl, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "fal_ai" });
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
          await writeMedia(outPath, Buffer.from(await res.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          const segOutputUrl = `/api/media/${relPath}`;
          if (projectId) trackJob(projectId, mode, plan.editType, prompt, plan.enhancedPrompt, "segmind", segOutputUrl);
          return NextResponse.json({ outputUrl: segOutputUrl, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "segmind" });
        }
      } catch (e) { console.warn("[ai-edit] segmind gen failed:", e); }
    }

    return NextResponse.json({ error: "No image generation provider available. Set FAL_API_KEY or SEGMIND_API_KEY." }, { status: 503 });
  }

  // Image editing (has source image)
  if (FAL_KEY) {
    try {
      const dataUrl = `data:${imageMime ?? "image/png"};base64,${imageBase64}`;
      // Migrated to providers/fal adapter (Henry 2026-05-30 task #29).
      const { falFluxImg2Img } = await import("@/lib/providers/fal");
      const r = await falFluxImg2Img({ prompt: plan.enhancedPrompt, imageUrl: dataUrl, strength: 0.65, numInferenceSteps: 28 });
      if (r.ok) {
        const imgUrl = r.data.images?.[0]?.url;
        if (imgUrl) {
          const imgRes = await fetch(imgUrl);
          const outPath = path.join(outDir, `edit_${Date.now()}.png`);
          await writeMedia(outPath, Buffer.from(await imgRes.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          const editOutputUrl = `/api/media/${relPath}`;
          if (projectId) trackJob(projectId, mode, plan.editType, prompt, plan.enhancedPrompt, "fal_ai", editOutputUrl);
          return NextResponse.json({ outputUrl: editOutputUrl, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "fal_ai" });
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
        await writeMedia(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        const segEditUrl = `/api/media/${relPath}`;
        if (projectId) trackJob(projectId, mode, plan.editType, prompt, plan.enhancedPrompt, "segmind", segEditUrl);
        return NextResponse.json({ outputUrl: segEditUrl, editType: plan.editType, enhancedPrompt: plan.enhancedPrompt, provider: "segmind" });
      }
    } catch (e) { console.warn("[ai-edit] segmind edit failed:", e); }
  }

  return NextResponse.json({ error: "No image editing provider available. Set FAL_API_KEY or SEGMIND_API_KEY." }, { status: 503 });
}
