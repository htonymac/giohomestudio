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
import { createSlideshow, mergeMedia, type SlideshowFrame, type RenderQuality } from "@/modules/ffmpeg";
import { isActualFile } from "@/modules/ffmpeg/utils";
import { createContentItem, updateContentItem } from "@/modules/content-registry";
import { resolveAndGenerateMusic } from "@/modules/music-provider/resolver";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
import { callLLM } from "@/lib/llm";
import { loadLLMSettings } from "@/lib/llm-settings";
import {
  renderCommercialCaptionPngs,
  overlayCaptionsOnVideo,
  cleanupComposedDir,
  type CaptionAnimation,
} from "@/modules/caption-compositor";
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

  // Build raw slide list with all styling/animation fields
  type RawSlide = {
    imagePath: string;
    durationMs: number;
    captionText: string | null;
    captionPosition: string | null;
    captionPreset: string | null;
    fontOverride: string | null;
    fontSizeScale: number;
    motionPreset: string | undefined;
    animation: CaptionAnimation;
    narrationText: string | null;
    showNarration: boolean;
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
        captionPosition: globalCaptionPosition ?? (typeof enh?.captionPosition === "string" ? enh.captionPosition : null),
        captionPreset:   (typeof enh?.captionPreset   === "string" ? enh.captionPreset   : null),
        fontOverride:    (typeof enh?.fontFamily      === "string" ? enh.fontFamily      : null),
        fontSizeScale:   (typeof enh?.fontSizeScale   === "number" ? enh.fontSizeScale   : 0.7),
        motionPreset:    (typeof enh?.motionPreset    === "string" ? enh.motionPreset    : undefined),
        animation:       (typeof enh?.captionAnimation === "string" ? enh.captionAnimation : "fade-up") as CaptionAnimation,
        narrationText:   s.narrationLine ?? null,
        showNarration:   typeof enh?.showNarration === "boolean" ? enh.showNarration : false,
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
      imagePath:     rawSlides[rawSlides.length - 1].imagePath,
      durationMs:    2500,
      captionText:   ctaLines.join("\n"),
      captionPosition: "bottom",
      captionPreset:   "promo",
      fontOverride:    null,
      fontSizeScale:   0.7,
      motionPreset:    undefined,
      animation:       "fade-up",
      narrationText:   null,
      showNarration:   false,
      frameId:         `${contentItemId}_cta`,
    });
  }

  // ── Step 1: Ken Burns slideshow on ORIGINAL images (no caption baked in) ─────
  // Captions are overlaid separately AFTER Ken Burns so they stay fixed on screen
  // while the background image moves. This is the 2-pass approach.
  const frames: SlideshowFrame[] = rawSlides.map(s => ({
    imagePath: s.imagePath,
    durationMs: s.durationMs,
    motionPreset: s.motionPreset as SlideshowFrame["motionPreset"],
  }));

  const slideshowDir = path.join(env.storagePath, "video");
  fs.mkdirSync(slideshowDir, { recursive: true });
  const ts = Date.now();
  const slideshowPath  = path.join(slideshowDir, `commercial_${contentItemId}_motion_${ts}.mp4`);
  const captionedPath  = path.join(slideshowDir, `commercial_${contentItemId}_captioned_${ts}.mp4`);

  // Fetch project-level settings stored via raw SQL
  let transitionType: "fade" | "slide-left" | "slide-right" | "zoom-in" | "none" | undefined;
  let transitionDurationSec: number | undefined;
  let globalCaptionPosition: "top" | "center" | "bottom" | null = null;
  let renderQuality: RenderQuality = "standard";
  try {
    const tRows = await prisma.$queryRaw<Array<{
      transitionType: string | null;
      transitionDurationSec: number | null;
      globalCaptionPosition: string | null;
      renderQuality: string | null;
    }>>`
      SELECT "transitionType", "transitionDurationSec", "globalCaptionPosition", "renderQuality"
      FROM commercial_projects WHERE id = ${project.id} LIMIT 1
    `;
    if (tRows[0]) {
      if (tRows[0].transitionType) {
        transitionType = tRows[0].transitionType as typeof transitionType;
        transitionDurationSec = tRows[0].transitionDurationSec ?? 0.5;
      }
      globalCaptionPosition = (tRows[0].globalCaptionPosition ?? null) as typeof globalCaptionPosition;
      renderQuality = (tRows[0].renderQuality as RenderQuality | null) ?? "standard";
    }
  } catch { /* columns may not exist yet */ }

  // Pass 1: use "cinema" quality (CRF 12) for the intermediate so the caption
  // overlay pass has excellent source material without creating enormous files.
  // CRF 0 (lossless) creates 5-20GB intermediate files that break the pipeline.
  console.log(`[Commercial render:${contentItemId}] Step 1 — Ken Burns slideshow (${frames.length} slides)...`);
  const slideResult = await createSlideshow(frames, slideshowPath, aspectRatio, {
    transitionType,
    transitionDurationSec,
    quality: "cinema",
  });

  if (!slideResult.success || !slideResult.outputPath) {
    const err = slideResult.error ?? "unknown";
    console.error(`[Commercial render:${contentItemId}] Step 1 FAILED — ${err}`);
    throw new Error(`Ken Burns slideshow failed: ${err}`);
  }
  console.log(`[Commercial render:${contentItemId}] Step 1 done → ${slideResult.outputPath}`);

  // ── Step 2: Render transparent caption/narration PNGs via Playwright ─────────
  const composedDir = path.join(env.storagePath, "composed");
  console.log(`[Commercial render:${contentItemId}] Step 2 — Rendering ${rawSlides.length} caption overlay(s)...`);
  const captionPngs = await renderCommercialCaptionPngs({
    slides: rawSlides,
    aspectRatio,
    workDir: composedDir,
  });

  // ── Step 3: Overlay caption PNGs on the motion video ─────────────────────────
  // Each caption PNG fades/flies in at its slide start time, stays fixed on screen.
  // Build start/end time offsets per slide (accounting for xfade transition overlap)
  const tDur = (transitionType && transitionType !== "none") ? (transitionDurationSec ?? 0.5) : 0;
  let cumulSec = 0;
  type OverlayEntry = import("@/modules/caption-compositor").VideoOverlayItem;
  const overlays: OverlayEntry[] = [];

  rawSlides.forEach((s, i) => {
    const startSec = cumulSec;
    cumulSec += s.durationMs / 1000 - tDur;  // each slide starts earlier due to transition overlap
    const endSec   = cumulSec + tDur;         // overlap window
    const cpng = captionPngs[i];
    if (!cpng) return;
    if (cpng.captionPngPath) {
      overlays.push({ pngPath: cpng.captionPngPath, startSec: Math.max(0, startSec), endSec, animation: cpng.animation });
    }
    if (cpng.narrationPngPath) {
      overlays.push({ pngPath: cpng.narrationPngPath, startSec: Math.max(0, startSec + 0.3), endSec: Math.max(0, endSec - 0.2), animation: "fade" });
    }
  });

  // Pass 2 (final): encode at user's quality setting
  console.log(`[Commercial render:${contentItemId}] Step 3 — Caption overlay (${overlays.length} layers, quality=${renderQuality})...`);
  const overlayResult = await overlayCaptionsOnVideo(slideResult.outputPath, overlays, captionedPath, renderQuality);
  cleanupComposedDir(composedDir);

  if (!overlayResult.success) {
    console.warn(`[Commercial render:${contentItemId}] Step 3 caption overlay failed (${overlayResult.error}) — using motion-only video`);
  }
  // Use captioned video if overlay succeeded, else fall back to motion video
  const finalVideoPath = (overlayResult.success && isActualFile(captionedPath)) ? captionedPath : slideResult.outputPath;
  console.log(`[Commercial render:${contentItemId}] Step 3 done → ${finalVideoPath}`);
  // Batch status + videoPath into one write
  await updateContentItem(contentItemId, { status: "GENERATING_VOICE", videoPath: finalVideoPath });

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
    videoPath: finalVideoPath,
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
