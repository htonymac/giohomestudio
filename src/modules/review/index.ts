// GioHomeStudio — Review Module
// Handles the approve / reject / send-back flow.

import { prisma } from "@/lib/prisma";
import { updateContentItem, createContentVersion } from "@/modules/content-registry";
import { telegramAlertProvider } from "@/modules/alerts/telegram";
import type { ReviewAction, ReviewActionType } from "@/types/content";

export async function getPendingReviewItems() {
  return prisma.contentItem.findMany({
    where: { status: "IN_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: { destinationPage: true },
  });
}

export async function approveContent(
  contentItemId: string,
  note?: string
): Promise<{ success: boolean }> {
  const item = await prisma.contentItem.findUnique({ where: { id: contentItemId } });
  if (!item) return { success: false };

  await updateContentItem(contentItemId, {
    status: "APPROVED",
    approvedAt: new Date(),
  });

  await prisma.reviewAction.create({
    data: {
      contentItemId,
      action: "APPROVED",
      reviewerNote: note,
    },
  });

  await prisma.alertLog.create({
    data: {
      contentItemId,
      channel: "telegram",
      message: `✅ Content approved.\nID: ${contentItemId}`,
      status: "PENDING",
    },
  });

  // Send Telegram alert
  const alertResult = await telegramAlertProvider.send({
    message: `✅ *Content Approved*\nID: \`${contentItemId}\`${note ? `\nNote: ${note}` : ""}`,
    contentItemId,
  });

  await prisma.alertLog.updateMany({
    where: { contentItemId, status: "PENDING" },
    data: {
      status: alertResult.status === "sent" ? "SENT" : "FAILED",
      error: alertResult.error,
      sentAt: alertResult.status === "sent" ? new Date() : undefined,
    },
  });

  return { success: true };
}

export async function rejectContent(
  contentItemId: string,
  note?: string
): Promise<{ success: boolean }> {
  const item = await prisma.contentItem.findUnique({ where: { id: contentItemId } });
  if (!item) return { success: false };

  // Save rejected version before status change
  await createContentVersion({
    contentItemId,
    status: "REJECTED",
    enhancedPrompt: item.enhancedPrompt ?? undefined,
    videoPath: item.videoPath ?? undefined,
    voicePath: item.voicePath ?? undefined,
    musicPath: item.musicPath ?? undefined,
    mergedOutputPath: item.mergedOutputPath ?? undefined,
    reason: note ?? "Rejected by reviewer",
  });

  await updateContentItem(contentItemId, {
    status: "REJECTED",
    rejectedAt: new Date(),
  });

  await prisma.reviewAction.create({
    data: {
      contentItemId,
      action: "REJECTED",
      reviewerNote: note,
    },
  });

  // Log + send Telegram alert (mirrors approve flow)
  await prisma.alertLog.create({
    data: {
      contentItemId,
      channel: "telegram",
      message: `❌ Content rejected.\nID: ${contentItemId}`,
      status: "PENDING",
    },
  });

  const rejectAlertResult = await telegramAlertProvider.send({
    message: `❌ *Content Rejected*\nID: \`${contentItemId}\`${note ? `\nReason: ${note}` : ""}`,
    contentItemId,
  });

  await prisma.alertLog.updateMany({
    where: { contentItemId, status: "PENDING" },
    data: {
      status: rejectAlertResult.status === "sent" ? "SENT" : "FAILED",
      error: rejectAlertResult.error,
      sentAt: rejectAlertResult.status === "sent" ? new Date() : undefined,
    },
  });

  return { success: true };
}

export async function getReviewHistory(contentItemId: string): Promise<ReviewAction[]> {
  const actions = await prisma.reviewAction.findMany({
    where: { contentItemId },
    orderBy: { createdAt: "desc" },
  });
  return actions as ReviewAction[];
}
