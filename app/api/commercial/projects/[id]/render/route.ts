// POST /api/commercial/projects/[id]/render
//
// Assembles a commercial from uploaded slide images:
// 1. Validate slides have images
// 2. Create a ContentItem (mode=COMMERCIAL)
// 3. Compose caption overlays via HTML→PNG (CaptionCompositor — no FFmpeg drawtext)
// 4. Build slideshow from composed images + per-slide durations
// 5. Generate narration from assembled narrationScript
// 6. Resolve music track
// 7. Merge video + voice + music → mergedOutputPath
// 8. Update ContentItem → IN_REVIEW

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { createSlideshow, mergeMedia, type SlideshowFrame } from "@/modules/ffmpeg";
import { isActualFile } from "@/modules/ffmpeg/utils";
import { createContentItem, updateContentItem } from "@/modules/content-registry";
import { resolveAndGenerateMusic } from "@/modules/music-provider/resolver";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
import { callLLM } from "@/lib/llm";
import { loadLLMSettings } from "@/lib/llm-settings";
import { composeCommercialSlides, cleanupComposedDir } from "@/modules/caption-compositor";
import type { CommercialProject, CommercialSlide } from "@prisma/client";

type ProjectWithSlides = CommercialProject & { slides: CommercialSlide[] };

function assembleNarrationText(project: ProjectWithSlides): string {
  return (
    project.narrationScript?.trim() ||
    project.slides
      .map(s => s.narrationLine ?? s.captionPolished ?? s.captionOriginal ?? "")
      .filter(Boolean)
      .join(" ")
  );
}

async function renderCommercial(project: ProjectWithSlides, contentItemId: string) {
  await updateContentItem(contentItemId, { status: "GENERATING_VIDEO" });

  const aspectRatio = (project.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1";

  // Build raw slide list — captions will be composed via HTML→PNG, NOT via FFmpeg drawtext
  type RawSlide = {
    imagePath: string;
    durationMs: number;
    captionText: string | null;
    captionPosition: string | null;
    captionPreset: string | null;
    fontOverride: string | null;
    frameId: string;
  };

  let rawSlides: RawSlide[] = project.slides
    .filter(s => isActualFile(s.imagePath ?? ""))
    .map(s => {
      const captionText = (s.captionApproved && s.captionPolished
        ? s.captionPolished
        : s.captionOriginal
      ) ?? null;
      const enh = s.enhancementSettings as Record<string, unknown> | null;
      return {
        imagePath: s.imagePath!,
        durationMs: s.durationMs,
        captionText,
        captionPosition: (typeof enh?.captionPosition === "string" ? enh.captionPosition : null),
        captionPreset:   (typeof enh?.captionPreset   === "string" ? enh.captionPreset   : null),
        fontOverride:    (typeof enh?.fontFamily      === "string" ? enh.fontFamily      : null),
        frameId: `${contentItemId}_s${s.slideOrder}`,
      };
    });

  if (rawSlides.length === 0) throw new Error("No slides with images found");

  // Auto-distribute: divide targetDurationSec evenly across all frames
  if (project.autoDistribute && project.targetDurationSec && project.targetDurationSec > 0) {
    const perSlideMs = Math.round((project.targetDurationSec * 1000) / rawSlides.length);
    rawSlides = rawSlides.map(s => ({ ...s, durationMs: Math.max(500, perSlideMs) }));
  }

  // Append a dedicated CTA frame using the last slide's image
  if (project.ctaMethod && project.ctaValue) {
    const ctaLabel = project.ctaMethod === "whatsapp" ? "WhatsApp"
      : project.ctaMethod === "telegram" ? "Telegram" : "Call";
    const ctaLines = [ctaLabel, project.ctaValue];
    if (project.ctaValueSecondary) ctaLines.push(project.ctaValueSecondary);
    rawSlides.push({
      imagePath:       rawSlides[rawSlides.length - 1].imagePath,
      durationMs:      2500,
      captionText:     ctaLines.join("\n"),
      captionPosition: "bottom",
      captionPreset:   "promo",
      fontOverride:    null,
      frameId:         `${contentItemId}_cta`,
    });
  }

  // ── Caption Composition (HTML→PNG via Playwright, then FFmpeg overlay) ──────
  // No drawtext. No FFmpeg text expressions. Text is rendered in Chromium, which
  // handles word-wrap, safe zones, font rendering, and overflow containment correctly.
  const composedDir = path.join(env.storagePath, "composed");
  console.log(`[Commercial render:${contentItemId}] Compositing captions for ${rawSlides.length} slides...`);
  const composedResults = await composeCommercialSlides({
    slides: rawSlides,
    aspectRatio,
    workDir: composedDir,
  });

  // Build SlideshowFrame[] from composed results — no captionText needed (already baked in)
  let frames: SlideshowFrame[] = rawSlides.map((s, i) => ({
    imagePath: composedResults[i]?.imagePath ?? s.imagePath,
    durationMs: s.durationMs,
    // captionText intentionally omitted — no drawtext in slideshow
  }));

  const slideshowDir = path.join(env.storagePath, "video");
  fs.mkdirSync(slideshowDir, { recursive: true });
  const slideshowPath = path.join(slideshowDir, `commercial_${contentItemId}_${Date.now()}.mp4`);

  // skipKenBurns: static concat is fast (~5s) and plays well with pre-composed PNGs.
  const slideResult = await createSlideshow(frames, slideshowPath, aspectRatio, { skipKenBurns: true });

  // Clean up composed temp PNGs after the video is written
  cleanupComposedDir(composedDir);
  if (!slideResult.success || !slideResult.outputPath) {
    console.error(`[Commercial render:${contentItemId}] Slideshow FAILED — ${slideResult.error}`);
    console.error(`[Commercial render:${contentItemId}] Frames: ${frames.map(f => f.imagePath).join(", ")}`);
    throw new Error(`Slideshow failed: ${slideResult.error}`);
  }
  // Batch status + videoPath into one write
  await updateContentItem(contentItemId, { status: "GENERATING_VOICE", videoPath: slideResult.outputPath });

  // Try local LLM (phi3) to write a polished commercial narration from the slide content.
  // Falls back to raw assembled text if Ollama is unavailable — no ElevenLabs credits wasted on poor copy.
  const rawNarration = assembleNarrationText(project);
  let narrationText = rawNarration;
  if (rawNarration) {
    const brand = project.brandName ? `Brand: ${project.brandName}. ` : "";
    const llmResult = await callLLM(
      `Write a short, natural commercial voiceover script from these slide notes. Keep it under 60 words. No headers, no bullet points — just the spoken words.\n\nSlide notes:\n${rawNarration}`,
      `You are a commercial copywriter. ${brand}Write concise, persuasive promotional scripts. Warm tone. No filler. Output only the script text.`,
      { role: "creative", temperature: 0.5, maxTokens: 150, timeoutMs: 15000 }
    );
    if (llmResult.ok) {
      narrationText = llmResult.text;
      console.log(`[Commercial render:${contentItemId}] Narration improved by LLM (${llmResult.provider}) ✓`);
    } else {
      console.warn(`[Commercial render:${contentItemId}] LLM unavailable (${llmResult.error}) — using raw captions`);
    }
  }

  let voicePath: string | null = null;
  if (narrationText) {
    const elevenKey = loadLLMSettings().ELEVENLABS_API_KEY || env.elevenlabs.apiKey;
    const voiceProvider = elevenKey ? elevenLabsVoiceProvider : mockVoiceProvider;
    try {
      const voiceDir = path.resolve(env.storagePath, "voice");
      fs.mkdirSync(voiceDir, { recursive: true });
      const voiceOutPath = path.join(voiceDir, `commercial_${contentItemId}.mp3`);
      const voiceResult = await voiceProvider.generate({
        text: narrationText,
        outputPath: voiceOutPath,
        voiceId: project.voiceId ?? undefined,
        language: project.voiceLanguage ?? undefined,
      });
      if (voiceResult.status === "completed" && voiceResult.localPath) {
        voicePath = voiceResult.localPath;
      }
    } catch (err) {
      console.warn(`[Commercial render:${contentItemId}] Voice failed: ${err} — proceeding without voice`);
    }
  }

  // Batch status + voicePath + narration into one write
  await updateContentItem(contentItemId, {
    status: "GENERATING_MUSIC",
    ...(voicePath ? { voicePath, narrationScript: narrationText } : {}),
  });

  let musicPath: string | null = project.musicPath ?? null;
  if (!musicPath) {
    try {
      const totalSecs = Math.ceil(frames.reduce((acc, f) => acc + f.durationMs, 0) / 1000);
      const musicResult = await resolveAndGenerateMusic({ genre: "cinematic", durationSeconds: totalSecs, mood: "professional" });
      if (musicResult.status === "completed" && musicResult.localPath) {
        musicPath = musicResult.localPath;
      }
    } catch (err) {
      console.warn(`[Commercial render:${contentItemId}] Music failed: ${err} — proceeding without music`);
    }
  }

  // Batch status + musicPath into one write
  await updateContentItem(contentItemId, {
    status: "MERGING",
    ...(musicPath ? { musicPath, musicSource: project.musicPath ? "uploaded" : "stock" } : {}),
  });

  const mergedDir = path.join(env.storagePath, "merged");
  fs.mkdirSync(mergedDir, { recursive: true });

  const mergeResult = await mergeMedia({
    videoPath: slideResult.outputPath,
    voicePath,
    musicPath,
    outputFileName: `commercial_${contentItemId}_final.mp4`,
    musicVolume: project.musicVolume,
    voiceVolume: project.narrationVolume ?? 1.0,
  });

  if (!mergeResult.success || !mergeResult.outputPath) {
    console.error(`[Commercial render:${contentItemId}] Merge FAILED — ${mergeResult.error}`);
    throw new Error(`Merge failed: ${mergeResult.error}`);
  }

  try {
    await Promise.all([
      updateContentItem(contentItemId, { mergedOutputPath: mergeResult.outputPath, status: "IN_REVIEW" }),
      prisma.commercialProject.update({
        where: { id: project.id },
        data: { renderStatus: "ready", contentItemId },
      }),
    ]);
  } catch (finalErr) {
    // Log but don't throw — the GET handler auto-heals renderStatus from the content item state.
    console.error(`[Commercial render:${contentItemId}] Final DB write failed (will auto-heal on next GET):`, finalErr);
  }

  console.log(`[Commercial render:${contentItemId}] Done → ${mergeResult.outputPath}`);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({
    where: { id },
    include: { slides: { orderBy: { slideOrder: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const readySlides = project.slides.filter(s => isActualFile(s.imagePath ?? ""));
  if (readySlides.length === 0) {
    return NextResponse.json(
      { error: "No slides with uploaded images. Upload at least one image before rendering." },
      { status: 400 }
    );
  }

  const narrationText = assembleNarrationText(project);

  const [contentItem] = await Promise.all([
    createContentItem({
      originalInput:     `Commercial: ${project.projectName}`,
      mode:              "COMMERCIAL",
      outputMode:        "images_audio",
      audioMode:         "voice_music",
      aspectRatio:       project.aspectRatio,
      durationSeconds:   Math.ceil(project.slides.reduce((acc, s) => acc + s.durationMs, 0) / 1000),
      narrationScript:   narrationText || undefined,
      destinationPageId: project.destinationPageId ?? undefined,
      aiAutoMode:        false,
    }),
    // contentItemId updated immediately so the GET auto-heal reads the correct in-progress item.
    prisma.commercialProject.update({ where: { id }, data: { renderStatus: "rendering", contentItemId: null } }),
  ]);

  // Set contentItemId immediately so polling can track the new render's status.
  await prisma.commercialProject.update({ where: { id }, data: { contentItemId: contentItem.id } });

  renderCommercial(project, contentItem.id).catch(async err => {
    console.error(`[Commercial render] Failed:`, err);
    await Promise.all([
      updateContentItem(contentItem.id, { status: "FAILED", notes: String(err) }),
      prisma.commercialProject.update({ where: { id }, data: { renderStatus: "failed" } }),
    ]);
  });

  return NextResponse.json(
    { contentItemId: contentItem.id, message: `Rendering ${readySlides.length} slide${readySlides.length !== 1 ? "s" : ""}. Check Review when ready.` },
    { status: 202 }
  );
}
