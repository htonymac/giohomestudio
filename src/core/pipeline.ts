// GioHomeStudio — Phase 1 Pipeline Orchestrator
//
// Status flow:
//   PENDING → ENHANCING → GENERATING_VIDEO → GENERATING_VOICE
//   → GENERATING_MUSIC → MERGING → IN_REVIEW
//   Error at any blocking step → FAILED (notes field holds the reason)
//
// Provider selection:
//   Video : Kling (if credentials set) | mock_video (fallback)
//   Voice : ElevenLabs (if API key set) | mock_voice (fallback)
//   Music : env.music.provider → stock_library fallback

import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { promptEnhancer } from "@/modules/prompt-enhancer";
import { runSupervisor, inferMusicMoodFromPrompt } from "@/modules/supervisor";
import { generateSceneImage } from "@/modules/comfyui";
import { runwayVideoProvider } from "@/modules/video-provider/runway";
import { klingVideoProvider } from "@/modules/video-provider/kling";
import { mockVideoProvider } from "@/modules/video-provider/mock";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
import { resolveAndGenerateMusic } from "@/modules/music-provider/resolver";
import { mergeMedia, mergeAudioOnly, createSlideshow, type SFXCue, type SlideshowFrame } from "@/modules/ffmpeg";
import { parseDialogueScript, flattenScriptToNarration } from "@/modules/dialogue-parser";
import { parseBeats } from "@/modules/beat-parser";
import { generateMultiVoiceAudio } from "@/modules/multi-voice";
import { resolveSFXPaths, resolveAutoSFXPaths, getSFXPath } from "@/modules/sfx";
import {
  createContentItem,
  updateContentItem,
  createContentVersion,
} from "@/modules/content-registry";
import { telegramAlertProvider } from "@/modules/alerts/telegram";
import type { IVideoProvider, IVoiceProvider, SpeechStyle } from "@/types/providers";
import type { PipelineInput, PipelineResult } from "@/types/pipeline";
import type { Prisma } from "@prisma/client";
import { JobType } from "@prisma/client";

const POLL_INTERVAL_MS = 8000;
const MAX_POLL_ATTEMPTS = 90; // 12-minute timeout (Runway gen4.5 can take 3-8 min)

// ── Provider resolution ─────────────────────────────────────
// Priority: draft quality (→ mock) → per-request override → VIDEO_PROVIDER env var
// Falls back to mock_video if credentials for the chosen provider are missing.

function resolveVideoProvider(requestOverride?: string, quality?: string): IVideoProvider {
  // Draft quality always uses mock — saves API credits during iteration
  if (quality === "draft") {
    console.log("[Pipeline] Video provider: mock_video (quality=draft)");
    return mockVideoProvider;
  }
  const chosen = requestOverride ?? env.video.provider;

  if (chosen === "kling") {
    if (env.kling.accessKey && env.kling.secretKey) {
      const src = requestOverride ? "request" : "VIDEO_PROVIDER";
      console.log(`[Pipeline] Video provider: kling (selected via ${src})`);
      return klingVideoProvider;
    }
    console.warn("[Pipeline] kling selected but credentials not set — falling back to mock_video");
    return mockVideoProvider;
  }

  if (chosen === "runway") {
    if (env.runway.apiKey) {
      const src = requestOverride ? "request" : "VIDEO_PROVIDER";
      console.log(`[Pipeline] Video provider: runway (selected via ${src})`);
      return runwayVideoProvider;
    }
    console.warn("[Pipeline] runway selected but RUNWAY_API_KEY not set — falling back to mock_video");
    return mockVideoProvider;
  }

  // mock_video or unrecognised value
  console.log(`[Pipeline] Video provider: mock_video (chosen=${chosen})`);
  return mockVideoProvider;
}

function resolveVoiceProvider(requestOverride?: string): IVoiceProvider {
  // Explicit mock request — force mock even if key is set (useful for fast testing)
  if (requestOverride === "mock_voice") {
    console.log("[Pipeline] Voice provider: mock_voice (forced by request)");
    return mockVoiceProvider;
  }
  // Explicit elevenlabs request — use it if key is set, else fail-fast to mock
  if (requestOverride === "elevenlabs") {
    if (env.elevenlabs.apiKey) {
      console.log("[Pipeline] Voice provider: elevenlabs (forced by request)");
      return elevenLabsVoiceProvider;
    }
    console.warn("[Pipeline] elevenlabs forced but ELEVENLABS_API_KEY not set — falling back to mock_voice");
    return mockVoiceProvider;
  }
  // Auto (default): use ElevenLabs if key is present
  if (env.elevenlabs.apiKey) {
    console.log("[Pipeline] Voice provider: elevenlabs (auto)");
    return elevenLabsVoiceProvider;
  }
  console.log("[Pipeline] Voice provider: mock_voice (ElevenLabs key not set)");
  return mockVoiceProvider;
}

// ── Job helpers ─────────────────────────────────────────────

async function createJob(contentItemId: string, type: JobType) {
  return prisma.job.create({
    data: { contentItemId, type, status: "QUEUED" },
  });
}

async function updateJob(jobId: string, updates: Prisma.JobUpdateInput) {
  return prisma.job.update({ where: { id: jobId }, data: updates });
}

// ── Video polling — provider-agnostic ───────────────────────
// Checks immediately first (mock/sync providers resolve at once).

async function pollVideoJob(
  provider: IVideoProvider,
  jobId: string
): Promise<string | null> {
  // Immediate check — handles mock providers that complete synchronously
  const immediate = await provider.checkStatus(jobId);
  if (immediate.status === "completed") return immediate.videoUrl ?? null;
  if (immediate.status === "failed") return null;

  // Poll for async providers (e.g. Kling)
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const status = await provider.checkStatus(jobId);
    if (status.status === "completed") return status.videoUrl ?? null;
    if (status.status === "failed") return null;
  }

  return null; // timed out
}

// ── Main pipeline ────────────────────────────────────────────

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const jobResults: PipelineResult["jobResults"] = {};
  const videoProvider = resolveVideoProvider(input.videoProvider, input.videoQuality);
  const voiceProvider = resolveVoiceProvider(input.requestedVoiceProvider);

  // ── 1. Create content item (status: PENDING) ──────────────
  // If the API route pre-created the item (to return the ID immediately),
  // reuse it; otherwise create a new one here.
  let contentItemId: string;
  if (input.contentItemId) {
    contentItemId = input.contentItemId;
  } else {
    const contentItem = await createContentItem({
      originalInput: input.rawInput,
      mode: "FREE",
      durationSeconds: input.durationSeconds,
      destinationPageId: input.destinationPageId,
      requestedVideoProvider: input.videoProvider,
      videoQuality: input.videoQuality,
      videoType: input.videoType,
      visualStyle: input.visualStyle,
      subjectType: input.subjectType,
      customSubjectDescription: input.customSubjectDescription,
      aiAutoMode: input.aiAutoMode,
      voiceId: input.voiceId,
      voiceLanguage: input.voiceLanguage,
      requestedVoiceProvider: input.requestedVoiceProvider,
      narrationSpeed: input.narrationSpeed,
      narrationVolume: input.narrationVolume,
      audioMode: input.audioMode,
      aspectRatio: input.aspectRatio ?? "9:16",
      requestedMusicProvider: input.musicProvider,
      musicVolume: input.musicVolume,
      musicGenre: input.musicGenre,
      musicRegion: input.musicRegion,
      castingEthnicity: input.castingEthnicity,
      castingGender: input.castingGender,
      castingAge: input.castingAge,
      castingCount: input.castingCount,
      cultureContext: input.cultureContext,
      referenceImageUrl: input.referenceImageUrl,
      storyContext: input.storyContext,
      previousContentItemId: input.previousContentItemId,
      storyThreadId: input.storyThreadId ?? input.previousContentItemId ?? undefined,
    });
    contentItemId = contentItem.id;
  }
  // Store outputMode and castingCharacters only when item was created inside this function (not pre-created by API route)
  if (!input.contentItemId && (input.outputMode || (input.castingCharacters?.length ?? 0) > 0)) {
    await updateContentItem(contentItemId, {
      ...(input.outputMode ? { outputMode: input.outputMode } : {}),
      ...(input.castingCharacters ? { castingCharacters: input.castingCharacters } : {}),
    });
  }
  console.log(`[Pipeline] Started — contentItemId: ${contentItemId}, outputMode: ${input.outputMode ?? "text_to_video"}`);

  try {
    // ── 1.5. Supervisor / Orchestration plan ─────────────────
    let supervisorPlan = null;
    if (input.aiAutoMode !== false) {
      try {
        supervisorPlan = await runSupervisor({
          rawPrompt: input.rawInput,
          overrides: {
            videoType: input.videoType,
            visualStyle: input.visualStyle,
            aspectRatio: input.aspectRatio,
            musicMood: input.musicMood,
            musicGenre: input.musicGenre,
            castingEthnicity: input.castingEthnicity,
            cultureContext: input.cultureContext,
            audioMode: input.outputMode === "text_to_audio" ? "audio_only" : input.audioMode,
          },
        });
        await updateContentItem(contentItemId, { supervisorPlan: supervisorPlan as unknown as Record<string, unknown> });
        console.log(`[Pipeline:${contentItemId}] Supervisor plan ready (${supervisorPlan.supervisedBy}, confidence: ${supervisorPlan.confidence})`);
      } catch (err) {
        console.warn(`[Pipeline:${contentItemId}] Supervisor skipped: ${err}`);
      }
    }

    // ── 2. Prompt Enhancement ─────────────────────────────────
    console.log(`[Pipeline:${contentItemId}] → ENHANCING`);
    await updateContentItem(contentItemId, { status: "ENHANCING" });
    const enhanceJob = await createJob(contentItemId, "PROMPT_ENHANCE");
    await updateJob(enhanceJob.id, { status: "RUNNING", startedAt: new Date() });

    const enhanced = await promptEnhancer.enhance({
      rawInput: input.rawInput,
      mode: "FREE",
      targetDuration: input.durationSeconds,
      videoType: input.videoType,
      visualStyle: input.visualStyle,
      subjectType: input.subjectType,
      customSubjectDescription: input.customSubjectDescription,
      aiAutoMode: input.aiAutoMode,
      castingEthnicity: input.castingEthnicity,
      castingGender: input.castingGender,
      castingAge: input.castingAge,
      castingCount: input.castingCount,
      cultureContext: input.cultureContext,
      referenceImageUrl: input.referenceImageUrl,
      storyContext: input.storyContext,
    });

    await updateContentItem(contentItemId, {
      enhancedPrompt: enhanced.enhancedPrompt,
      narrationScript: enhanced.narrationScript,
    });
    await updateJob(enhanceJob.id, { status: "COMPLETED", completedAt: new Date() });
    jobResults.promptEnhance = { success: true, enhancedPrompt: enhanced.enhancedPrompt };
    console.log(`[Pipeline:${contentItemId}] Prompt enhanced ✓`);

    // ── 2b. Detect dialogue structure from narration script ───
    const parsedScript = parseDialogueScript(enhanced.narrationScript);
    const isMultiVoice = parsedScript.isMultiVoice;
    if (isMultiVoice) {
      console.log(`[Pipeline:${contentItemId}] Multi-voice dialogue detected — speakers: ${parsedScript.speakers.join(", ")}`);
    }
    if (parsedScript.hasSFX) {
      console.log(`[Pipeline:${contentItemId}] SFX events in script: ${parsedScript.sfxEvents.join(", ")}`);
    }

    // ── 2c. Parse beats from narration script ─────────────────
    const beatTimeline = parseBeats(enhanced.narrationScript ?? input.rawInput, {
      outputMode: input.outputMode ?? "text_to_video",
      castingCharacters: input.castingCharacters,
      storyThreadId: input.storyThreadId,
    });
    console.log(`[Pipeline:${contentItemId}] Beat parser: ${beatTimeline.beats.length} beats, ${Math.round(beatTimeline.totalDurationMs / 1000)}s estimated`);

    // Persist beat timeline — merge into supervisorPlan so the detail page can read it
    if (supervisorPlan) {
      await updateContentItem(contentItemId, {
        supervisorPlan: { ...supervisorPlan, beatTimeline } as unknown as Record<string, unknown>,
      });
    }

    // ── 3. Video Generation ───────────────────────────────────
    // Skipped when audioMode = "audio_only" OR outputMode = "text_to_audio"
    const isAudioOnly    = input.audioMode === "audio_only" || input.outputMode === "text_to_audio";
    const isImagesAudio  = input.outputMode === "images_audio";
    const isHybrid       = input.outputMode === "hybrid";
    const isVideoToVideo = input.outputMode === "video_to_video";
    const isImageToVideo = input.outputMode === "image_to_video";

    if (isAudioOnly) {
      console.log(`[Pipeline:${contentItemId}] → Skipping video (audioMode=audio_only)`);
      jobResults.videoGenerate = { success: true, videoPath: undefined };
    } else if (isImagesAudio) {
      // ── 3a. Images + Audio — generate still images per beat then build slideshow ──
      console.log(`[Pipeline:${contentItemId}] → GENERATING_IMAGES (images_audio mode)`);
      await updateContentItem(contentItemId, { status: "GENERATING_VIDEO", videoProvider: "comfyui" });
      const imgJob = await createJob(contentItemId, "VIDEO_GENERATE");
      await updateJob(imgJob.id, { status: "RUNNING", startedAt: new Date(), providerUsed: "comfyui" });

      const aspectRatio = (input.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1";
      const imageBeats  = beatTimeline.beats.filter(b => b.type === "image" && b.imagePrompt);

      // Build frame list — image beats get AI-generated images; narration/dialogue beats
      // carry over the most recent generated image (or get a placeholder frame).
      const slideshowFrames: SlideshowFrame[] = [];
      const imageDir = path.join(env.storagePath, "images", contentItemId);
      fs.mkdirSync(imageDir, { recursive: true });

      // Dispatch all image generations concurrently — ComfyUI queues them server-side,
      // so parallel submission doesn't overload the GPU but avoids blocking the pipeline
      // between submissions.
      const generatedImages = new Map<string, string>(
        (await Promise.all(imageBeats.map(async beat => {
          try {
            const { imageBuffer } = await generateSceneImage({ prompt: beat.imagePrompt!, aspectRatio });
            const imgPath = path.join(imageDir, `${beat.id}.png`);
            fs.writeFileSync(imgPath, imageBuffer);
            console.log(`[Pipeline:${contentItemId}] Scene image ✓ → ${beat.id}`);
            return [beat.id, imgPath] as [string, string];
          } catch (err) {
            console.warn(`[Pipeline:${contentItemId}] Scene image failed for beat ${beat.id}: ${err} — skipping`);
            return null;
          }
        }))).filter((r): r is [string, string] => r !== null)
      );

      // Build slideshow frame sequence from the full beat timeline
      let lastImagePath: string | null = null;
      for (const beat of beatTimeline.beats) {
        if (beat.type === "sfx" || beat.type === "ambience" || beat.type === "silence") continue;
        if (beat.type === "image") {
          const img = generatedImages.get(beat.id);
          if (img) {
            lastImagePath = img;
            slideshowFrames.push({ imagePath: img, durationMs: beat.durationMs });
          }
          continue;
        }
        // narration / dialogue beats — show last image or skip if none yet
        if (lastImagePath) {
          slideshowFrames.push({ imagePath: lastImagePath, durationMs: beat.durationMs });
        }
      }

      // If no images at all (e.g. no [IMAGE:] tags in script), generate one from the full prompt
      if (slideshowFrames.length === 0) {
        try {
          const { imageBuffer } = await generateSceneImage({ prompt: enhanced.enhancedPrompt, aspectRatio });
          const fallbackPath = path.join(imageDir, "fallback.png");
          fs.writeFileSync(fallbackPath, imageBuffer);
          const totalMs = beatTimeline.totalDurationMs || (input.durationSeconds ?? 30) * 1000;
          slideshowFrames.push({ imagePath: fallbackPath, durationMs: totalMs });
          console.log(`[Pipeline:${contentItemId}] Fallback scene image generated`);
        } catch {
          console.warn(`[Pipeline:${contentItemId}] Could not generate any images — slideshow will fail`);
        }
      }

      if (slideshowFrames.length > 0) {
        const slideshowPath = path.join(env.storagePath, "video", `slideshow_${contentItemId}_${Date.now()}.mp4`);
        const slideResult = await createSlideshow(slideshowFrames, slideshowPath, aspectRatio);
        if (slideResult.success && slideResult.outputPath) {
          await updateContentItem(contentItemId, { videoPath: slideResult.outputPath });
          await updateJob(imgJob.id, { status: "COMPLETED", outputPath: slideResult.outputPath, completedAt: new Date() });
          jobResults.videoGenerate = { success: true, videoPath: slideResult.outputPath };
          console.log(`[Pipeline:${contentItemId}] Slideshow ready ✓ → ${slideResult.outputPath}`);
        } else {
          await updateJob(imgJob.id, { status: "FAILED", error: slideResult.error, completedAt: new Date() });
          jobResults.videoGenerate = { success: false };
          throw new Error(`Slideshow creation failed: ${slideResult.error}`);
        }
      } else {
        await updateJob(imgJob.id, { status: "FAILED", error: "No slideshow frames", completedAt: new Date() });
        throw new Error("images_audio: no frames could be generated");
      }
    } else if (isVideoToVideo) {
      // ── 3b. Video-to-Video — use the uploaded source video directly ──────
      console.log(`[Pipeline:${contentItemId}] → VIDEO_TO_VIDEO (source: ${input.sourceVideoPath ?? "none"})`);

      if (!input.sourceVideoPath || !fs.existsSync(input.sourceVideoPath)) {
        throw new Error("video_to_video mode requires a valid sourceVideoPath. Upload a source video first.");
      }

      const videoFileName = `v2v_source_${contentItemId}_${Date.now()}.mp4`;
      const videoPath = path.join(env.storagePath, "video", videoFileName);
      fs.mkdirSync(path.dirname(videoPath), { recursive: true });
      await fs.promises.copyFile(input.sourceVideoPath, videoPath);

      await updateContentItem(contentItemId, { videoPath, videoProvider: "v2v_passthrough" });
      jobResults.videoGenerate = { success: true, videoPath };
      console.log(`[Pipeline:${contentItemId}] V2V source ready ✓ → ${videoPath}`);

    } else if (isImageToVideo) {
      // ── 3b-i. Image → Video — referenceImageUrl is the source frame; action prompt drives motion ──
      console.log(`[Pipeline:${contentItemId}] → IMAGE_TO_VIDEO (source: ${input.referenceImageUrl ?? "none"})`);

      if (!input.referenceImageUrl) {
        throw new Error("image_to_video mode requires a referenceImageUrl (saved character or uploaded image).");
      }

      await updateContentItem(contentItemId, {
        status: "GENERATING_VIDEO",
        videoProvider: videoProvider.name,
      });
      const i2vJob = await createJob(contentItemId, "VIDEO_GENERATE");
      await updateJob(i2vJob.id, { status: "RUNNING", startedAt: new Date(), providerUsed: videoProvider.name });

      // Build the generation prompt: action + visual context from enhanced prompt
      const actionLine = input.imageActionPrompt?.trim();
      const i2vPrompt  = actionLine
        ? `${actionLine}. ${enhanced.enhancedPrompt}`
        : enhanced.enhancedPrompt;

      const effectiveDuration = input.videoQuality === "high"
        ? Math.max(input.durationSeconds ?? 5, 10)
        : (input.durationSeconds ?? 5);

      let i2vResult = await videoProvider.generate({
        prompt: i2vPrompt,
        durationSeconds: effectiveDuration,
        aspectRatio: input.aspectRatio ?? "9:16",
        referenceImageUrl: input.referenceImageUrl,
      });

      let activeI2vProvider = videoProvider;
      if (i2vResult.status === "failed" && videoProvider.name !== mockVideoProvider.name) {
        console.warn(`[Pipeline:${contentItemId}] i2v provider failed — falling back to mock_video`);
        activeI2vProvider = mockVideoProvider;
        await updateContentItem(contentItemId, { videoProvider: mockVideoProvider.name });
        i2vResult = await mockVideoProvider.generate({
          prompt: i2vPrompt,
          durationSeconds: effectiveDuration,
          aspectRatio: input.aspectRatio ?? "9:16",
        });
      }

      if (i2vResult.status === "failed") {
        await updateJob(i2vJob.id, { status: "FAILED", error: i2vResult.error, completedAt: new Date() });
        jobResults.videoGenerate = { success: false };
        throw new Error(`Image-to-video generation failed: ${i2vResult.error}`);
      }

      const i2vVideoUrl = await pollVideoJob(activeI2vProvider, i2vResult.jobId);
      if (!i2vVideoUrl) {
        await updateJob(i2vJob.id, { status: "FAILED", error: "i2v polling timed out", completedAt: new Date() });
        throw new Error("Image-to-video provider timed out");
      }

      const i2vFileName = `i2v_${contentItemId}_${Date.now()}.mp4`;
      const i2vVideoPath = path.join(env.storagePath, "video", i2vFileName);
      await activeI2vProvider.download(i2vResult.jobId, i2vVideoPath);

      await updateContentItem(contentItemId, { videoPath: i2vVideoPath });
      await updateJob(i2vJob.id, { status: "COMPLETED", outputPath: i2vVideoPath, completedAt: new Date() });
      jobResults.videoGenerate = { success: true, videoPath: i2vVideoPath };
      console.log(`[Pipeline:${contentItemId}] Image-to-video ✓ → ${i2vVideoPath}`);

    } else if (isHybrid) {
      // ── 3c. Hybrid — action beats via video provider, rest via ComfyUI images ──
      console.log(`[Pipeline:${contentItemId}] → GENERATING_HYBRID`);
      await updateContentItem(contentItemId, { status: "GENERATING_VIDEO", videoProvider: "hybrid" });
      const hybridJob = await createJob(contentItemId, "VIDEO_GENERATE");
      await updateJob(hybridJob.id, { status: "RUNNING", startedAt: new Date(), providerUsed: "hybrid" });

      const aspectRatio = (input.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1";
      const imageDir = path.join(env.storagePath, "images", contentItemId);
      fs.mkdirSync(imageDir, { recursive: true });

      const actionBeats  = beatTimeline.beats.filter(b => b.isActionBeat && b.type !== "sfx" && b.type !== "ambience" && b.type !== "silence");
      const imageBeats   = beatTimeline.beats.filter(b => !b.isActionBeat && (b.type === "image" || b.type === "narration" || b.type === "dialogue") && b.imagePrompt);

      const actionClips = new Map<string, string>();
      if (actionBeats.length > 0) {
        await Promise.all(actionBeats.map(async beat => {
          try {
            const beatDuration = Math.max(5, Math.ceil(beat.durationMs / 1000));
            const clipInput = {
              prompt: beat.imagePrompt ?? beat.text ?? enhanced.enhancedPrompt,
              durationSeconds: beatDuration,
              aspectRatio,
            };
            let clipResult = await videoProvider.generate(clipInput);
            let clipProvider = videoProvider;
            // Fallback to mock if real provider fails
            if (clipResult.status === "failed" && videoProvider.name !== mockVideoProvider.name) {
              clipResult = await mockVideoProvider.generate(clipInput);
              clipProvider = mockVideoProvider;
            }
            if (clipResult.status !== "failed") {
              const clipUrl = await pollVideoJob(clipProvider, clipResult.jobId);
              if (clipUrl) {
                const clipPath = path.join(imageDir, `action_clip_${beat.id}.mp4`);
                await clipProvider.download(clipResult.jobId, clipPath);
                actionClips.set(beat.id, clipPath);
                console.log(`[Pipeline:${contentItemId}] Action clip ✓ → beat ${beat.id}`);
              }
            }
          } catch (err) {
            console.warn(`[Pipeline:${contentItemId}] Action clip failed for beat ${beat.id}: ${err} — skipping`);
          }
        }));
      }

      const generatedImages = new Map<string, string>(
        (await Promise.all(imageBeats.map(async beat => {
          try {
            const { imageBuffer } = await generateSceneImage({ prompt: beat.imagePrompt!, aspectRatio });
            const imgPath = path.join(imageDir, `img_${beat.id}.png`);
            fs.writeFileSync(imgPath, imageBuffer);
            return [beat.id, imgPath] as [string, string];
          } catch (err) {
            console.warn(`[Pipeline:${contentItemId}] Scene image failed for beat ${beat.id}: ${err}`);
            return null;
          }
        }))).filter((r): r is [string, string] => r !== null)
      );

      const slideshowFrames: SlideshowFrame[] = [];
      let lastImagePath: string | null = null;
      for (const beat of beatTimeline.beats) {
        if (beat.isActionBeat || beat.type === "sfx" || beat.type === "ambience" || beat.type === "silence") continue;
        if (beat.type === "image") {
          const img = generatedImages.get(beat.id);
          if (img) { lastImagePath = img; slideshowFrames.push({ imagePath: img, durationMs: beat.durationMs }); }
        } else if (lastImagePath) {
          slideshowFrames.push({ imagePath: lastImagePath, durationMs: beat.durationMs });
        }
      }

      // Determine final video: if we have action clips, concat them with the image slideshow
      // For simplicity (no ffmpeg concat here), use action clips if present, else fall back to slideshow
      if (actionClips.size > 0) {
        // Use the first action clip as the primary video; full hybrid concat is a future enhancement
        const [, firstClipPath] = [...actionClips.entries()][0];
        await updateContentItem(contentItemId, { videoPath: firstClipPath });
        await updateJob(hybridJob.id, { status: "COMPLETED", outputPath: firstClipPath, completedAt: new Date() });
        jobResults.videoGenerate = { success: true, videoPath: firstClipPath };
        console.log(`[Pipeline:${contentItemId}] Hybrid: using ${actionClips.size} action clip(s) ✓`);
      } else if (slideshowFrames.length > 0) {
        // No action clips — fall back to slideshow of all non-action images
        const slideshowPath = path.join(env.storagePath, "video", `hybrid_${contentItemId}_${Date.now()}.mp4`);
        const slideResult = await createSlideshow(slideshowFrames, slideshowPath, aspectRatio);
        if (slideResult.success && slideResult.outputPath) {
          await updateContentItem(contentItemId, { videoPath: slideResult.outputPath });
          await updateJob(hybridJob.id, { status: "COMPLETED", outputPath: slideResult.outputPath, completedAt: new Date() });
          jobResults.videoGenerate = { success: true, videoPath: slideResult.outputPath };
          console.log(`[Pipeline:${contentItemId}] Hybrid slideshow fallback ✓`);
        } else {
          await updateJob(hybridJob.id, { status: "FAILED", error: slideResult.error, completedAt: new Date() });
          throw new Error(`Hybrid slideshow fallback failed: ${slideResult.error}`);
        }
      } else {
        // Nothing generated — use mock video as last resort
        console.warn(`[Pipeline:${contentItemId}] Hybrid: no media generated — falling back to mock video`);
        const mockInput = { prompt: enhanced.enhancedPrompt, durationSeconds: input.durationSeconds ?? 5, aspectRatio };
        const mockResult = await mockVideoProvider.generate(mockInput);
        const mockUrl = await pollVideoJob(mockVideoProvider, mockResult.jobId);
        if (!mockUrl) throw new Error("Hybrid: mock video fallback failed");
        const mockPath = path.join(env.storagePath, "video", `hybrid_mock_${contentItemId}_${Date.now()}.mp4`);
        await mockVideoProvider.download(mockResult.jobId, mockPath);
        await updateContentItem(contentItemId, { videoPath: mockPath });
        await updateJob(hybridJob.id, { status: "COMPLETED", outputPath: mockPath, completedAt: new Date() });
        jobResults.videoGenerate = { success: true, videoPath: mockPath };
      }

    } else {
    console.log(`[Pipeline:${contentItemId}] → GENERATING_VIDEO (${videoProvider.name})`);
    await updateContentItem(contentItemId, {
      status: "GENERATING_VIDEO",
      videoProvider: videoProvider.name,
    });
    const videoJob = await createJob(contentItemId, "VIDEO_GENERATE");
    await updateJob(videoJob.id, {
      status: "RUNNING",
      startedAt: new Date(),
      providerUsed: videoProvider.name,
    });

    // high quality → request 10s; draft/standard use the user-chosen duration
    const effectiveDuration =
      input.videoQuality === "high"
        ? Math.max(input.durationSeconds ?? 5, 10)
        : (input.durationSeconds ?? 5);

    const videoGenInput = {
      prompt: enhanced.enhancedPrompt,
      durationSeconds: effectiveDuration,
      aspectRatio: input.aspectRatio ?? "9:16",
    };

    let videoResult = await videoProvider.generate(videoGenInput);
    let activeVideoProvider = videoProvider;

    // Auto-fallback to mock if real provider fails (rate limit, 5xx, network, etc.)
    if (videoResult.status === "failed" && videoProvider.name !== mockVideoProvider.name) {
      const providerError = videoResult.error ?? "unknown error";
      // Surface credit/auth errors clearly so the dashboard shows the real reason
      const isCreditError = providerError.toLowerCase().includes("credit") ||
        providerError.toLowerCase().includes("quota") ||
        providerError.toLowerCase().includes("balance") ||
        providerError.toLowerCase().includes("payment");
      if (isCreditError) {
        console.warn(
          `[Pipeline:${contentItemId}] ⚠️  ${videoProvider.name} — INSUFFICIENT CREDITS. Top up your account to use real video generation. Falling back to mock_video.`
        );
      } else {
        console.warn(
          `[Pipeline:${contentItemId}] ${videoProvider.name} failed (${providerError}) — falling back to mock_video`
        );
      }
      activeVideoProvider = mockVideoProvider;
      await updateContentItem(contentItemId, {
        videoProvider: mockVideoProvider.name,
        notes: isCreditError
          ? `${videoProvider.name} — insufficient credits. Top up your account.`
          : `${videoProvider.name} failed: ${providerError}`,
      });
      await updateJob(videoJob.id, {
        providerUsed: mockVideoProvider.name,
        error: `${videoProvider.name} failed: ${providerError}`,
      });
      videoResult = await mockVideoProvider.generate(videoGenInput);
    }

    if (videoResult.status === "failed") {
      await updateJob(videoJob.id, {
        status: "FAILED",
        error: videoResult.error,
        completedAt: new Date(),
      });
      jobResults.videoGenerate = { success: false };
      throw new Error(`Video generation failed: ${videoResult.error}`);
    }

    // Poll until completed (immediate for mock, async for Kling)
    const videoUrl = await pollVideoJob(activeVideoProvider, videoResult.jobId);
    if (!videoUrl) {
      await updateJob(videoJob.id, {
        status: "FAILED",
        error: "Video polling timed out or failed",
        completedAt: new Date(),
      });
      throw new Error(`Video provider (${activeVideoProvider.name}) timed out`);
    }

    // Download to local storage
    const videoFileName = `video_${contentItemId}_${Date.now()}.mp4`;
    const videoPath = path.join(env.storagePath, "video", videoFileName);
    await activeVideoProvider.download(videoResult.jobId, videoPath);

    await updateContentItem(contentItemId, { videoPath });
    await updateJob(videoJob.id, {
      status: "COMPLETED",
      outputPath: videoPath,
      completedAt: new Date(),
    });
    jobResults.videoGenerate = { success: true, videoPath };
    console.log(`[Pipeline:${contentItemId}] Video ready ✓ → ${videoPath} (via ${activeVideoProvider.name})`);
    } // end !isAudioOnly block

    // ── 4. Voice Generation ───────────────────────────────────
    // Skipped when audioMode is "music_only".
    // Non-blocking: failure is logged but does not abort the pipeline.
    const skipVoice = input.audioMode === "music_only";

    if (skipVoice) {
      console.log(`[Pipeline:${contentItemId}] → Voice skipped (audioMode=music_only)`);
      jobResults.voiceGenerate = { success: true, voicePath: undefined };
    } else {
      console.log(`[Pipeline:${contentItemId}] → GENERATING_VOICE (${voiceProvider.name}${isMultiVoice ? ", multi-voice" : ""})`);
      await updateContentItem(contentItemId, {
        status: "GENERATING_VOICE",
        voiceProvider: voiceProvider.name,
      });
      const voiceJob = await createJob(contentItemId, "VOICE_GENERATE");
      await updateJob(voiceJob.id, {
        status: "RUNNING",
        startedAt: new Date(),
        providerUsed: voiceProvider.name,
      });

      let finalVoicePath: string | undefined;

      if (isMultiVoice) {
        // Multi-voice: generate per-speaker segments then concatenate
        // Pass scene-level speechStyle — user override wins, supervisor-detected is the fallback
        // (individual turns in the script may still override with inline direction tags)
        const mvResult = await generateMultiVoiceAudio(
          contentItemId,
          parsedScript.turns,
          voiceProvider,
          {
            speed: input.narrationSpeed,
            language: input.voiceLanguage,
            defaultSpeechStyle: (input.speechStyle ?? supervisorPlan?.speechStyle) as SpeechStyle | undefined,
          }
        );
        if (mvResult.success && mvResult.mergedVoicePath) {
          finalVoicePath = mvResult.mergedVoicePath;
          console.log(`[Pipeline:${contentItemId}] Multi-voice ready ✓ → ${finalVoicePath} (${parsedScript.turns.length} turns)`);
        } else {
          console.warn(`[Pipeline:${contentItemId}] Multi-voice failed: ${mvResult.error} — retrying as single-voice`);
          // Fallthrough to single-voice below
        }
      }

      if (!finalVoicePath) {
        // Single-voice (or multi-voice fallback)
        const voiceFileName = `voice_${contentItemId}_${Date.now()}.mp3`;
        const voicePath = path.join(env.storagePath, "voice", voiceFileName);
        const narrationText = isMultiVoice
          ? flattenScriptToNarration(parsedScript)  // flatten to plain text for single-voice fallback
          : enhanced.narrationScript;

        const voiceGenInput = {
          text: narrationText,
          voiceId: input.voiceId,
          speed: input.narrationSpeed,
          language: input.voiceLanguage,
          voiceModel: input.voiceModel,
          outputPath: voicePath,
          speechStyle: (input.speechStyle ?? supervisorPlan?.speechStyle) as SpeechStyle | undefined,
        };

        let voiceResult = await voiceProvider.generate(voiceGenInput);

        // Auto-fallback to mock if real voice provider fails
        if (voiceResult.status === "failed" && voiceProvider.name !== mockVoiceProvider.name) {
          const voiceError = voiceResult.error ?? "unknown error";
          console.warn(`[Pipeline:${contentItemId}] ${voiceProvider.name} failed (${voiceError}) — falling back to mock_voice`);
          await updateContentItem(contentItemId, { voiceProvider: mockVoiceProvider.name });
          await updateJob(voiceJob.id, {
            providerUsed: mockVoiceProvider.name,
            error: `${voiceProvider.name} failed: ${voiceError}`,
          });
          voiceResult = await mockVoiceProvider.generate(voiceGenInput);
        }

        if (voiceResult.status !== "failed") {
          finalVoicePath = voiceResult.localPath;
        } else {
          console.warn(`[Pipeline:${contentItemId}] Voice generation failed (non-blocking): ${voiceResult.error}`);
          await updateJob(voiceJob.id, { status: "FAILED", error: voiceResult.error, completedAt: new Date() });
          jobResults.voiceGenerate = { success: false };
        }
      }

      if (finalVoicePath) {
        await updateContentItem(contentItemId, { voicePath: finalVoicePath, voiceSource: "generated" });
        await updateJob(voiceJob.id, { status: "COMPLETED", outputPath: finalVoicePath, completedAt: new Date() });
        jobResults.voiceGenerate = { success: true, voicePath: finalVoicePath };
        console.log(`[Pipeline:${contentItemId}] Voice ready ✓ → ${finalVoicePath}`);
      }
    }

    // ── 5. Music Generation ───────────────────────────────────
    // Skipped when audioMode is "voice_only".
    // Non-blocking: music is optional for merge.
    const skipMusic = input.audioMode === "voice_only";

    if (skipMusic) {
      console.log(`[Pipeline:${contentItemId}] → Music skipped (audioMode=voice_only)`);
      jobResults.musicGenerate = { success: true, musicPath: undefined };
    } else {
      console.log(`[Pipeline:${contentItemId}] → GENERATING_MUSIC`);
      await updateContentItem(contentItemId, { status: "GENERATING_MUSIC" });
      const musicJob = await createJob(contentItemId, "MUSIC_GENERATE");
      await updateJob(musicJob.id, { status: "RUNNING", startedAt: new Date() });

      const musicResult = await resolveAndGenerateMusic(
        {
          mood: input.musicMood ?? supervisorPlan?.inferredMusicMood ?? inferMusicMoodFromPrompt(input.rawInput),
          genre: input.musicGenre,
          region: input.musicRegion,
          durationSeconds: input.durationSeconds ?? 30,
        },
        input.musicProvider  // per-request override (stock_library | mock_music)
      );

    if (musicResult.status === "failed") {
      console.warn(
        `[Pipeline:${contentItemId}] Music generation failed (non-blocking): ${musicResult.error}`
      );
      await updateJob(musicJob.id, {
        status: "FAILED",
        error: musicResult.error,
        completedAt: new Date(),
      });
      jobResults.musicGenerate = { success: false };
    } else {
      await updateContentItem(contentItemId, {
        musicPath: musicResult.localPath ?? undefined,
        musicProvider: musicResult.providerName,
        musicSource: "stock",
      });
      await updateJob(musicJob.id, {
        status: "COMPLETED",
        outputPath: musicResult.localPath,
        providerUsed: musicResult.providerName,
        completedAt: new Date(),
      });
      jobResults.musicGenerate = { success: true, musicPath: musicResult.localPath };
      console.log(`[Pipeline:${contentItemId}] Music ready ✓ (${musicResult.providerName})`);
    }
    } // end skipMusic block

    // ── 6. FFmpeg Merge ───────────────────────────────────────
    console.log(`[Pipeline:${contentItemId}] → MERGING`);
    await updateContentItem(contentItemId, { status: "MERGING" });
    const mergeJob = await createJob(contentItemId, "FFMPEG_MERGE");
    await updateJob(mergeJob.id, {
      status: "RUNNING",
      startedAt: new Date(),
      providerUsed: "ffmpeg",
    });

    // Re-read current item to get the latest paths (voice/music may have been set above)
    const currentItem = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
    });

    // Resolve SFX files — two separate paths with different safety rules:
    //   Auto events   (supervisor-detected from script text) → only use files marked safeForAutoMode=true
    //   Manual events ([SFX: event] script tags)             → always allowed, user is explicitly requesting
    const autoSfxEvents  = [...new Set((supervisorPlan?.inferredSoundEvents as string[]) ?? [])];
    const manualSfxEvents = [...new Set(parsedScript.sfxEvents)];
    const autoSfxPaths   = resolveAutoSFXPaths(autoSfxEvents);
    const manualSfxPaths = resolveSFXPaths(manualSfxEvents);
    // Deduplicate by path in case auto and manual overlap
    const sfxPaths = [...new Set([...autoSfxPaths, ...manualSfxPaths])];

    // Build timed SFX cues from beat timeline — script [SFX:] and [AMBIENCE:] tags carry startMs.
    // These replace the flat sfxPaths when present, so each effect fires at the right moment.
    const sfxCues: SFXCue[] = beatTimeline.beats
      .filter(b => (b.type === "sfx" || b.type === "ambience") && b.sfxEvent)
      .flatMap(b => {
        const p = getSFXPath(b.sfxEvent!);
        if (!p) return [];
        return [{ path: p, startMs: b.startMs }];
      });
    if (sfxCues.length > 0) {
      console.log(`[Pipeline:${contentItemId}] SFX layer: ${sfxCues.length} timed cues from beat timeline`);
    } else if (sfxPaths.length > 0) {
      console.log(`[Pipeline:${contentItemId}] SFX layer: ${sfxPaths.length} files flat-mixed (${autoSfxPaths.length} auto-safe, ${manualSfxPaths.length} manual)`);
    }

    let mergeResult;

    if (isAudioOnly) {
      // Audio-only output — no video, merge voice + music (+ SFX) into MP3
      const audioFileName = `merged_${contentItemId}_${Date.now()}.mp3`;
      mergeResult = await mergeAudioOnly({
        voicePath: currentItem?.voicePath ?? null,
        musicPath: currentItem?.musicPath ?? null,
        sfxCues: sfxCues.length > 0 ? sfxCues : undefined,
        sfxPaths,
        outputFileName: audioFileName,
        musicVolume: input.musicVolume,
        voiceVolume: input.narrationVolume,
      });
    } else {
      const mergedFileName = `merged_${contentItemId}_${Date.now()}.mp4`;
      const videoPathForMerge = currentItem?.videoPath ?? "";
      console.log(`[Pipeline:${contentItemId}] mergeMedia videoPath="${videoPathForMerge}"`);
      mergeResult = await mergeMedia({
        videoPath: videoPathForMerge,
        voicePath: currentItem?.voicePath ?? null,
        musicPath: currentItem?.musicPath ?? null,
        sfxCues: sfxCues.length > 0 ? sfxCues : undefined,
        sfxPaths,
        outputFileName: mergedFileName,
        musicVolume: input.musicVolume,
        voiceVolume: input.narrationVolume,
      });
    }

    if (!mergeResult.success) {
      await updateJob(mergeJob.id, {
        status: "FAILED",
        error: mergeResult.error,
        completedAt: new Date(),
      });
      jobResults.ffmpegMerge = { success: false };
      throw new Error(`FFmpeg merge failed: ${mergeResult.error}`);
    }

    await updateContentItem(contentItemId, { mergedOutputPath: mergeResult.outputPath });
    await updateJob(mergeJob.id, {
      status: "COMPLETED",
      outputPath: mergeResult.outputPath,
      completedAt: new Date(),
    });
    jobResults.ffmpegMerge = { success: true, mergedPath: mergeResult.outputPath };
    console.log(`[Pipeline:${contentItemId}] Merge complete ✓ → ${mergeResult.outputPath}`);

    // ── 7. Save version + Move to IN_REVIEW ──────────────────
    console.log(`[Pipeline:${contentItemId}] → IN_REVIEW`);
    await createContentVersion({
      contentItemId,
      status: "IN_REVIEW",
      enhancedPrompt: enhanced.enhancedPrompt,
      videoPath: currentItem?.videoPath ?? undefined,
      voicePath: currentItem?.voicePath ?? undefined,
      musicPath: currentItem?.musicPath ?? undefined,
      mergedOutputPath: mergeResult.outputPath,
      reason: isAudioOnly ? "Audio-only generation" : "Initial generation — Phase 1",
    });

    await updateContentItem(contentItemId, { status: "IN_REVIEW" });

    // ── 8. Telegram Alert (non-blocking) ─────────────────────
    telegramAlertProvider
      .send({
        message: `🎬 *New content ready for review*\nID: \`${contentItemId}\`\nPrompt: ${enhanced.enhancedPrompt.substring(0, 100)}...`,
        contentItemId,
      })
      .catch((err) =>
        console.warn(`[Pipeline:${contentItemId}] Telegram alert failed: ${err}`)
      );

    console.log(`[Pipeline:${contentItemId}] ✓ Complete — IN_REVIEW`);

    return {
      contentItemId,
      status: "review_pending",
      mergedOutputPath: mergeResult.outputPath,
      jobResults,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error(`[Pipeline:${contentItemId}] ✗ FAILED — ${errorMessage}`);

    // Always set FAILED (never back to PENDING) so the dashboard shows the real state
    await updateContentItem(contentItemId, {
      status: "FAILED",
      notes: errorMessage,
    }).catch(() => {
      // If even this update fails, log it — don't swallow
      console.error(`[Pipeline:${contentItemId}] Could not update status to FAILED`);
    });

    return {
      contentItemId,
      status: "failed",
      error: errorMessage,
      jobResults,
    };
  }
}
