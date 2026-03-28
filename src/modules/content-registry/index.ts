// GioHomeStudio — Content Registry Module
// All reads/writes to content_items go through this module.

import { prisma } from "@/lib/prisma";
import type { ContentItem, ContentStatus, ContentVersion } from "@/types/content";

export async function createContentItem(data: {
  originalInput: string;
  mode?: "FREE";
  durationSeconds?: number;
}): Promise<ContentItem> {
  const item = await prisma.contentItem.create({
    data: {
      originalInput: data.originalInput,
      mode: data.mode ?? "FREE",
      status: "PENDING",
      durationSeconds: data.durationSeconds,
    },
  });
  return item as ContentItem;
}

export async function updateContentItem(
  id: string,
  updates: Partial<{
    status: ContentStatus;
    enhancedPrompt: string;
    videoProvider: string;
    voiceProvider: string;
    musicProvider: string;
    videoPath: string;
    voicePath: string;
    musicPath: string;
    mergedOutputPath: string;
    durationSeconds: number;
    notes: string;
    approvedAt: Date;
    rejectedAt: Date;
  }>
): Promise<ContentItem> {
  const item = await prisma.contentItem.update({
    where: { id },
    data: updates,
  });
  return item as ContentItem;
}

export async function getContentItem(id: string): Promise<ContentItem | null> {
  const item = await prisma.contentItem.findUnique({ where: { id } });
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
