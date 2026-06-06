// GET /api/admin/cost — observability dashboard endpoint
//
// Returns a JSON snapshot of the cost-control infrastructure:
//   - LLM cache stats (total rows, hits, top 10 most-hit prompts)
//   - Daily spend per user for today + last 7 days
//   - Circuit breaker state per gateway
//   - Feature flag state (so an admin can see what's off)
//
// Auth: ADMIN_TOKEN env var match (Bearer or X-Admin-Token header).
//
// Used by maintainer + future admin UI to spot:
//   - Cache hit rate trending down (cache eviction too eager? prompt churn?)
//   - User spending more than expected (rogue script, abuse)
//   - Circuit breakers stuck OPEN (FAL outage)
//   - Feature flag mis-set (forgot to re-enable after maintenance)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCacheStats } from "@/lib/llm-cache";
import { listFlags } from "@/lib/feature-flags";
import { falBreaker, elevenLabsBreaker, klingBreaker } from "@/lib/rate-limit-defense";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = req.headers.get("x-admin-token");
  return bearer === expected || headerToken === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const [cacheStats, flags, todayKey, weekAgoKey] = [
      await getCacheStats(),
      await listFlags(),
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    ];

    const [todayTotal, topSpenders, last7Days] = await Promise.all([
      prisma.dailySpend.aggregate({
        where: { day: todayKey },
        _sum: { cents: true },
        _count: { userKey: true },
      }),
      prisma.dailySpend.findMany({
        where: { day: todayKey },
        orderBy: { cents: "desc" },
        take: 10,
        select: { userKey: true, cents: true },
      }),
      prisma.dailySpend.groupBy({
        by: ["day"],
        where: { day: { gte: weekAgoKey } },
        _sum: { cents: true },
        _count: { userKey: true },
      }),
    ]);

    return NextResponse.json({
      llmCache: {
        rows: cacheStats.total,
        totalHits: cacheStats.totalHits,
        topHits: cacheStats.topHits,
      },
      dailySpend: {
        today: {
          totalCents: todayTotal._sum.cents ?? 0,
          activeUsers: todayTotal._count.userKey ?? 0,
          topSpenders: topSpenders.map(r => ({ userKey: r.userKey.slice(0, 12) + "…", cents: r.cents })),
        },
        last7Days: last7Days.map(d => ({
          day: d.day,
          totalCents: d._sum.cents ?? 0,
          activeUsers: d._count.userKey ?? 0,
        })),
      },
      circuitBreakers: {
        fal: falBreaker.getState(),
        elevenlabs: elevenLabsBreaker.getState(),
        kling: klingBreaker.getState(),
      },
      flags: flags.map(f => ({ key: f.key, enabled: f.enabled, updatedAt: f.updatedAt })),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
