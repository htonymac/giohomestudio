// GioHomeStudio — Content Registry Module
// All reads/writes to content_items go through this module.

import { prisma } from "@/lib/prisma";
import type { ContentItem, ContentStatus, ContentVersion } from "@/types/content";

export async function createContentItem(data: {
  originalInput: string;
  mode?: "FREE" | "COMMERCIAL";
  durationSeconds?: number;
  destinationPageId?: string;
  requestedVideoProvider?: string;
  videoQuality?: string;
  videoType?: string;
  visualStyle?: string;
  subjectType?: string;
  customSubjectDescription?: string;
  aiAutoMode?: boolean;
  aspectRatio?: string;
  castingEthnicity?: string;
  castingGender?: string;
  castingAge?: string;
  castingCount?: string;
  cultureContext?: string;
  referenceImageUrl?: string;
  storyContext?: string;
  previousContentItemId?: string;
  storyThreadId?: string;
  voiceId?: string;
  voiceLanguage?: string;
  requestedVoiceProvider?: string;
  narrationSpeed?: number;
  narrationVolume?: number;
  outputMode?: string;
  audioMode?: string;
  castingCharacters?: string[];
  requestedMusicProvider?: string;
  musicVolume?: number;
  musicGenre?: string;
  musicRegion?: string;
  narrationScript?: string;
}): Promise<ContentItem> {
  const item = await prisma.contentItem.create({
    data: {
      originalInput: data.originalInput,
      mode: data.mode ?? "FREE",
      status: "PENDING",
      durationSeconds: data.durationSeconds,
      destinationPageId: data.destinationPageId,
      requestedVideoProvider: data.requestedVideoProvider ?? null,
      videoQuality: data.videoQuality ?? null,
      videoType: data.videoType ?? null,
      visualStyle: data.visualStyle ?? null,
      subjectType: data.subjectType ?? null,
      customSubjectDescription: data.customSubjectDescription ?? null,
      aiAutoMode: data.aiAutoMode ?? true,
      aspectRatio: data.aspectRatio ?? "9:16",
      castingEthnicity: data.castingEthnicity ?? null,
      castingGender: data.castingGender ?? null,
      castingAge: data.castingAge ?? null,
      castingCount: data.castingCount ?? null,
      cultureContext: data.cultureContext ?? null,
      referenceImageUrl: data.referenceImageUrl ?? null,
      storyContext: data.storyContext ?? null,
      previousContentItemId: data.previousContentItemId ?? null,
      storyThreadId: data.storyThreadId ?? null,
      voiceId: data.voiceId ?? null,
      voiceLanguage: data.voiceLanguage ?? null,
      requestedVoiceProvider: data.requestedVoiceProvider ?? null,
      narrationSpeed: data.narrationSpeed ?? null,
      narrationVolume: data.narrationVolume ?? null,
      outputMode: data.outputMode ?? null,
      audioMode: data.audioMode ?? null,
      castingCharacters: data.castingCharacters ?? [],
      requestedMusicProvider: data.requestedMusicProvider ?? null,
      musicVolume: data.musicVolume ?? null,
      musicGenre: data.musicGenre ?? null,
      musicRegion: data.musicRegion ?? null,
      narrationScript: data.narrationScript ?? null,
    },
    include: { destinationPage: true },
  });
  return item as ContentItem;
}

export async function updateContentItem(
  id: string,
  updates: Partial<{
    status: ContentStatus;
    enhancedPrompt: string;
    narrationScript: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supervisorPlan: any;
    voiceSource: string;
    musicSource: string;
    requestedVideoProvider: string;
    videoProvider: string;
    voiceProvider: string;
    requestedVoiceProvider: string;
    voiceId: string;
    voiceLanguage: string;
    narrationSpeed: number;
    narrationVolume: number;
    outputMode: string;
    audioMode: string;
    castingCharacters: string[];
    musicProvider: string;
    requestedMusicProvider: string;
    musicVolume: number;
    musicGenre: string;
    musicRegion: string;
    videoQuality: string;
    videoType: string;
    visualStyle: string;
    subjectType: string;
    customSubjectDescription: string;
    aiAutoMode: boolean;
    aspectRatio: string;
    castingEthnicity: string;
    castingGender: string;
    castingAge: string;
    castingCount: string;
    cultureContext: string;
    referenceImageUrl: string;
    videoPath: string;
    voicePath: string;
    musicPath: string;
    mergedOutputPath: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    overlayLayers: any;
    durationSeconds: number;
    notes: string;
    approvedAt: Date;
    rejectedAt: Date;
  }>
): Promise<ContentItem> {
  // overlayLayers is a Json field added after the initial migration.
  // The Prisma client may not include it until the server is restarted after
  // prisma generate. Strip it out and write it via raw SQL to avoid validation errors.
  const { overlayLayers, ...prismaUpdates } = updates as Record<string, unknown>;

  const item = await prisma.contentItem.update({
    where: { id },
    data: prismaUpdates,
  });

  if (overlayLayers !== undefined) {
    await prisma.$executeRaw`
      UPDATE "content_items"
      SET "overlayLayers" = ${JSON.stringify(overlayLayers)}::jsonb
      WHERE id = ${id}
    `;
  }

  return item as ContentItem;
}

export async function getContentItem(id: string): Promise<ContentItem | null> {
  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: { destinationPage: true },
  });
  return item as ContentItem | null;
}

export async function listContentItems(filters?: {
  status?: ContentStatus;
  limit?: number;
  offset?: number;
}): Promise<ContentItem[]> {
  const items = await prisma.contentItem.findMany({
    where: filters?.status ? { status: filters.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 50,
    skip: filters?.offset ?? 0,
    include: { destinationPage: true },
  });
  return items as ContentItem[];
}

export async function createContentVersion(data: {
  contentItemId: string;
  status: ContentStatus;
  enhancedPrompt?: string;
  videoPath?: string;
  voicePath?: string;
  musicPath?: string;
  mergedOutputPath?: string;
  reason?: string;
}): Promise<ContentVersion> {
  // Auto-increment version number
  const latestVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId: data.contentItemId },
    orderBy: { versionNumber: "desc" },
  });

  const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  const version = await prisma.contentVersion.create({
    data: {
      contentItemId: data.contentItemId,
      versionNumber,
      status: data.status,
      enhancedPrompt: data.enhancedPrompt,
      videoPath: data.videoPath,
      voicePath: data.voicePath,
      musicPath: data.musicPath,
      mergedOutputPath: data.mergedOutputPath,
      reason: data.reason,
    },
  });
  return version as ContentVersion;
}

export async function getContentVersions(contentItemId: string): Promise<ContentVersion[]> {
  const versions = await prisma.contentVersion.findMany({
    where: { contentItemId },
    orderBy: { versionNumber: "desc" },
  });
  return versions as ContentVersion[];
}
