// GioHomeStudio — POST /api/video-trimmer/execute
// Executes an approved TrimPlan, creates ContentItem, returns contentItemId.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { executeTrimPlan, type TrimPlan } from "@/modules/ffmpeg/trim-plan";
import { createContentItem, updateContentItem } from "@/modules/content-registry";
import { sanitizeFilename } from "@/lib/media-utils";

export async function POST(req: NextRequest) {
  let body: { videoPath?: string; plan?: TrimPlan; options?: { outputName?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { videoPath, plan, options } = body;
  if (!videoPath || !plan) {
    return NextResponse.json({ error: "Missing required fields: videoPath, plan" }, { status: 400 });
  }

  const safeName  = sanitizeFilename(options?.outputName ?? "trimmed", 50);
  const outputDir = path.join(env.storagePath, "outputs", "trimmer");
  const outputPath = path.join(outputDir, `${safeName}_${Date.now()}.mp4`);
  fs.mkdirSync(outputDir, { recursive: true });

  // Create ContentItem immediately so UI gets an ID back
  const item = await createContentItem({
    originalInput:   `AI Trim: ${plan.userInstruction}`,
    mode:            "FREE",
    outputMode:      "video_to_video",
    audioMode:       "voice_music",
    durationSeconds: Math.ceil(plan.outputDuration),
    aiAutoMode:      false,
  });

  // Run FFmpeg in background — caller polls registry/review for completion
  (async () => {
    try {
      await updateContentItem(item.id, { status: "GENERATING_VIDEO" });
      const result = await executeTrimPlan(videoPath, plan, outputPath);
      if (!result.success || !result.outputPath) throw new Error(result.error ?? "Trim execution failed");
      await updateContentItem(item.id, {
        status:           "IN_REVIEW",
        videoPath:        result.outputPath,
        mergedOutputPath: result.outputPath,
        notes:            `AI Trim Plan: ${plan.structure} | ${plan.segments.length} segments | ${Math.round(plan.outputDuration)}s`,
      });
    } catch (err) {
      await updateContentItem(item.id, { status: "FAILED", notes: String(err) });
    } finally {
      // Clean up the uploaded source file after execution
      try { fs.unlinkSync(path.resolve(videoPath)); } catch { /* ignore */ }
    }
  })();

  return NextResponse.json(
    {
      contentItemId:    item.id,
      outputDurationSec: plan.outputDuration,
      message: `Executing trim plan: ${plan.segments.length} segments. Check Review Queue when ready.`,
    },
    { status: 202 }
  );
}
