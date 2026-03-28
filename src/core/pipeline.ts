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
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { promptEnhancer } from "@/modules/prompt-enhancer";
import { runwayVideoProvider } from "@/modules/video-provider/runway";
import { klingVideoProvider } from "@/modules/video-provider/kling";
import { mockVideoProvider } from "@/modules/video-provider/mock";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
import { resolveAndGenerateMusic } from "@/modules/music-provider/resolver";
import { mergeMedia } from "@/modules/ffmpeg";
import {
  createContentItem,
  updateContentItem,
  createContentVersion,
} from "@/modules/content-registry";
import { telegramAlertProvider } from "@/modules/alerts/telegram";
import type { IVideoProvider, IVoiceProvider } from "@/types/providers";
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

function resolveVoiceProvider(): IVoiceProvider {
  if (env.elevenlabs.apiKey) {
    console.log("[Pipeline] Voice provider: elevenlabs");
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
  const voiceProvider = resolveVoiceProvider();

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
      requestedMusicProvider: input.musicProvider,
      musicVolume: input.musicVolume,
    });
    contentItemId = contentItem.id;
  }
  console.log(`[Pipeline] Started — contentItemId: ${contentItemId}`);

  try {
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
    });

    await updateContentItem(contentItemId, { enhancedPrompt: enhanced.enhancedPrompt });
    await updateJob(enhanceJob.id, { status: "COMPLETED", completedAt: new Date() });
    jobResults.promptEnhance = { success: true, enhancedPrompt: enhanced.enhancedPrompt };
    console.log(`[Pipeline:${contentItemId}] Prompt enhanced ✓`);

    // ── 3. Video Generation ───────────────────────────────────
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
      const klingError = videoResult.error ?? "unknown error";
      console.warn(
        `[Pipeline:${contentItemId}] ${videoProvider.name} failed (${klingError}) — falling back to mock_video`
      );
      activeVideoProvider = mockVideoProvider;
      await updateContentItem(contentItemId, { videoProvider: mockVideoProvider.name });
      await updateJob(videoJob.id, {
        providerUsed: mockVideoProvider.name,
        error: `${videoProvider.name} failed: ${klingError}`,
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

    // ── 4. Voice Generation ───────────────────────────────────
    // Non-blocking: failure is logged but does not abort the pipeline.
    console.log(`[Pipeline:${contentItemId}] → GENERATING_VOICE (${voiceProvider.name})`);
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

    const voiceFileName = `voice_${contentItemId}_${Date.now()}.mp3`;
    const voicePath = path.join(env.storagePath, "voice", voiceFileName);

    const voiceGenInput = {
      text: enhanced.enhancedPrompt,
      voiceId: input.voiceId,
      outputPath: voicePath,
    };

    let voiceResult = await voiceProvider.generate(voiceGenInput);

    // Auto-fallback to mock if real voice provider fails
    if (voiceResult.status === "failed" && voiceProvider.name !== mockVoiceProvider.name) {
      const elevenLabsError = voiceResult.error ?? "unknown error";
      console.warn(
        `[Pipeline:${contentItemId}] ${voiceProvider.name} failed (${elevenLabsError}) — falling back to mock_voice`
      );
      await updateContentItem(contentItemId, { voiceProvider: mockVoiceProvider.name });
      await updateJob(voiceJob.id, {
        providerUsed: mockVoiceProvider.name,
        error: `${voiceProvider.name} failed: ${elevenLabsError}`,
      });
      voiceResult = await mockVoiceProvider.generate(voiceGenInput);
    }

    if (voiceResult.status === "failed") {
      console.warn(
        `[Pipeline:${contentItemId}] Voice generation failed (non-blocking): ${voiceResult.error}`
      );
      await updateJob(voiceJob.id, {
        status: "FAILED",
        error: voiceResult.error,
        completedAt: new Date(),
      });
      jobResults.voiceGenerate = { success: false };
    } else {
      await updateContentItem(contentItemId, { voicePath: voiceResult.localPath });
      await updateJob(voiceJob.id, {
        status: "COMPLETED",
        outputPath: voiceResult.localPath,
        completedAt: new Date(),
      });
      jobResults.voiceGenerate = { success: true, voicePath: voiceResult.localPath };
      console.log(`[Pipeline:${contentItemId}] Voice ready ✓ → ${voiceResult.localPath}`);
    }

    // ── 5. Music Generation ───────────────────────────────────
    // Non-blocking: music is optional for merge.
    console.log(`[Pipeline:${contentItemId}] → GENERATING_MUSIC`);
    await updateContentItem(contentItemId, { status: "GENERATING_MUSIC" });
    const musicJob = await createJob(contentItemId, "MUSIC_GENERATE");
    await updateJob(musicJob.id, { status: "RUNNING", startedAt: new Date() });

    const musicResult = await resolveAndGenerateMusic(
      {
        mood: input.musicMood ?? "epic",
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

    const mergedFileName = `merged_${contentItemId}_${Date.now()}.mp4`;

    const mergeResult = await mergeMedia({
      videoPath: currentItem?.videoPath ?? videoPath,
      voicePath: currentItem?.voicePath ?? null,
      musicPath: currentItem?.musicPath ?? null,
      outputFileName: mergedFileName,
      musicVolume: input.musicVolume,  // user-controlled ducking; undefined → default 0.85
    });

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
      videoPath: currentItem?.videoPath ?? videoPath,
      voicePath: currentItem?.voicePath ?? undefined,
      musicPath: currentItem?.musicPath ?? undefined,
      mergedOutputPath: mergeResult.outputPath,
      reason: "Initial generation — Phase 1",
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
