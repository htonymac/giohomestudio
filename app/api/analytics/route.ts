// GET /api/analytics — aggregate stats for the analytics dashboard

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    byStatus,
    byMode,
    byProvider,
    recentItems,
    totalCount,
    commercialCount,
    freeCount,
    avgDuration,
  ] = await Promise.all([
    // Items grouped by status
    prisma.contentItem.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    }),
    // Items grouped by mode
    prisma.contentItem.groupBy({
      by: ["mode"],
      _count: true,
    }),
    // Items grouped by video provider
    prisma.contentItem.groupBy({
      by: ["videoProvider"],
      _count: true,
      orderBy: { _count: { videoProvider: "desc" } },
    }),
    // Last 30 items for timeline
    prisma.contentItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, mode: true, createdAt: true, durationSeconds: true, videoProvider: true, voiceProvider: true },
    }),
    prisma.contentItem.count(),
    prisma.contentItem.count({ where: { mode: "COMMERCIAL" } }),
    prisma.contentItem.count({ where: { mode: "FREE" } }),
    prisma.contentItem.aggregate({ _avg: { durationSeconds: true } }),
  ]);

  // Items by day (last 14 days)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const dailyItems = await prisma.contentItem.findMany({
    where: { createdAt: { gte: fourteenDaysAgo } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const dailyCounts: Record<string, { total: number; success: number; failed: number }> = {};
  for (const item of dailyItems) {
    const day = item.createdAt.toISOString().split("T")[0];
    if (!dailyCounts[day]) dailyCounts[day] = { total: 0, success: 0, failed: 0 };
    dailyCounts[day].total++;
    if (item.status === "IN_REVIEW" || item.status === "APPROVED" || item.status === "PUBLISHED") {
      dailyCounts[day].success++;
    } else if (item.status === "FAILED") {
      dailyCounts[day].failed++;
    }
  }

  const successCount = byStatus.filter(s =>
    ["IN_REVIEW", "APPROVED", "PUBLISHED"].includes(s.status)
  ).reduce((a, s) => a + s._count, 0);
  const failedCount = byStatus.find(s => s.status === "FAILED")?._count ?? 0;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  return NextResponse.json({
    summary: {
      totalCount,
      commercialCount,
      freeCount,
      successCount,
      failedCount,
      successRate,
      avgDurationSec: Math.round(avgDuration._avg.durationSeconds ?? 0),
    },
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
    byMode: byMode.map(m => ({ mode: m.mode, count: m._count })),
    byProvider: byProvider.filter(p => p.videoProvider).map(p => ({ provider: p.videoProvider, count: p._count })),
    daily: Object.entries(dailyCounts).map(([date, counts]) => ({ date, ...counts })),
    recentItems,
  });
}
