// POST /api/video-tools/motion-transfer
// Accepts a still image + motion reference video (multipart).
// Creates a ContentItem and queues generation via fal.ai or Segmind motion transfer API.
// Returns { contentItemId, message }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { createContentItem, updateContentItem } from "@/modules/content-registry";

const ALLOWED_IMAGE = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const image = form.get("image") as File | null;
  const video = form.get("video") as File | null;

  if (!image) return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  if (!video) return NextResponse.json({ error: "No motion reference video uploaded" }, { status: 400 });

  if (!ALLOWED_IMAGE.has(image.type)) {
    return NextResponse.json({ error: "Image must be PNG, JPEG, or WebP" }, { status: 400 });
  }
  if (!ALLOWED_VIDEO.has(video.type)) {
    return NextResponse.json({ error: "Video must be MP4, MOV, WEBM, or AVI" }, { status: 400 });
  }

  // Save uploads
  const uploadDir = path.join(env.storagePath, "video-tools", "motion-transfer");
  fs.mkdirSync(uploadDir, { recursive: true });

  const ts = Date.now();
  const imgExt = image.type === "image/png" ? ".png" : image.type === "image/webp" ? ".webp" : ".jpg";
  const imagePath = path.join(uploadDir, `source_${ts}${imgExt}`);
  const videoPath = path.join(uploadDir, `motion_ref_${ts}.mp4`);

  fs.writeFileSync(imagePath, Buffer.from(await image.arrayBuffer()));
  fs.writeFileSync(videoPath, Buffer.from(await video.arrayBuffer()));

  // Create content item for tracking
  const item = await createContentItem({
    originalInput: `Motion Transfer: animate image with motion reference`,
    outputMode: "motion_transfer",
    referenceImageUrl: imagePath,
  });

  // Queue the generation job (async — runs in background)
  processMotionTransfer(item.id, imagePath, videoPath).catch(err => {
    console.error(`[motion-transfer] Error for ${item.id}:`, err);
    updateContentItem(item.id, { status: "FAILED" });
  });

  return NextResponse.json({
    contentItemId: item.id,
    message: "Motion transfer queued. Check Review Queue for results.",
  });
}

async function processMotionTransfer(itemId: string, imagePath: string, motionVideoPath: string) {
  // Try fal.ai motion transfer (supports image + motion reference)
  const FAL_KEY = process.env.FAL_API_KEY;
  const SEGMIND_KEY = process.env.SEGMIND_API_KEY;

  if (FAL_KEY) {
    try {
      const imageBase64 = fs.readFileSync(imagePath).toString("base64");
      const videoBase64 = fs.readFileSync(motionVideoPath).toString("base64");
      const imgMime = imagePath.endsWith(".png") ? "image/png" : imagePath.endsWith(".webp") ? "image/webp" : "image/jpeg";

      const res = await fetch("https://queue.fal.run/fal-ai/animate-diff", {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: `data:${imgMime};base64,${imageBase64}`,
          motion_video_url: `data:video/mp4;base64,${videoBase64}`,
          num_inference_steps: 25,
          guidance_scale: 7.5,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.video?.url) {
          const videoRes = await fetch(data.video.url);
          const outPath = path.join(env.storagePath, "video-tools", "motion-transfer", `result_${itemId}.mp4`);
          fs.writeFileSync(outPath, Buffer.from(await videoRes.arrayBuffer()));
          updateContentItem(itemId, {
            status: "IN_REVIEW",
            mergedOutputPath: outPath,
            videoProvider: "fal_ai",
          });
          return;
        }
      }
    } catch (err) {
      console.warn(`[motion-transfer] fal.ai failed, trying fallback:`, err);
    }
  }

  if (SEGMIND_KEY) {
    try {
      const imageBase64 = fs.readFileSync(imagePath).toString("base64");
      const res = await fetch("https://api.segmind.com/v1/animate-anything", {
        method: "POST",
        headers: {
          "x-api-key": SEGMIND_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageBase64,
          prompt: "animate the subject with natural motion, high quality, smooth movement",
          num_inference_steps: 25,
        }),
      });

      if (res.ok) {
        const outPath = path.join(env.storagePath, "video-tools", "motion-transfer", `result_${itemId}.mp4`);
        fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
        updateContentItem(itemId, {
          status: "IN_REVIEW",
          mergedOutputPath: outPath,
          videoProvider: "segmind",
        });
        return;
      }
    } catch (err) {
      console.warn(`[motion-transfer] Segmind failed:`, err);
    }
  }

  // No provider available — mark as failed
  updateContentItem(itemId, {
    status: "FAILED",
  });
}
