// GET /api/budget — estimated cost breakdown by provider and time period

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Rough cost estimates per provider usage (credits/USD)
const COST_PER_USE: Record<string, number> = {
  runway:        0.10,  // ~$0.10 per 5s clip
  kling:         0.08,  // ~$0.08 per clip
  elevenlabs:    0.02,  // ~$0.02 per generation (based on character count)
  piper:         0.00,  // free (local)
  mock_video:    0.00,
  mock_voice:    0.00,
  mock_music:    0.00,
  stock_library: 0.00,
  kie_ai:        0.05,
};

export async function GET() {
  const items = await prisma.contentItem.findMany({
    select: {
      videoProvider: true,
      voiceProvider: true,
      musicSource: true,
      durationSeconds: true,
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate by provider
  const providerCosts: Record<string, { count: number; estimatedCost: number }> = {};
  let totalEstimated = 0;

  for (const item of items) {
    for (const provider of [item.videoProvider, item.voiceProvider, item.musicSource].filter(Boolean) as string[]) {
      if (!providerCosts[provider]) providerCosts[provider] = { count: 0, estimatedCost: 0 };
      providerCosts[provider].count++;
      const cost = COST_PER_USE[provider] ?? 0;
      providerCosts[provider].estimatedCost += cost;
      totalEstimated += cost;
    }
  }

  // Monthly breakdown (last 6 months)
  const monthly: Record<string, { count: number; cost: number }> = {};
  for (const item of items) {
    const month = item.createdAt.toISOString().slice(0, 7); // "2026-04"
    if (!monthly[month]) monthly[month] = { count: 0, cost: 0 };
    monthly[month].count++;
    for (const p of [item.videoProvider, item.voiceProvider].filter(Boolean) as string[]) {
      monthly[month].cost += COST_PER_USE[p] ?? 0;
    }
  }

  const totalItems = items.length;
  const costPerItem = totalItems > 0 ? totalEstimated / totalItems : 0;

  return NextResponse.json({
    totalEstimated: Math.round(totalEstimated * 100) / 100,
    totalItems,
    costPerItem: Math.round(costPerItem * 100) / 100,
    byProvider: Object.entries(providerCosts).map(([provider, data]) => ({
      provider,
      ...data,
      estimatedCost: Math.round(data.estimatedCost * 100) / 100,
    })).sort((a, b) => b.estimatedCost - a.estimatedCost),
    monthly: Object.entries(monthly)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([month, data]) => ({ month, ...data, cost: Math.round(data.cost * 100) / 100 })),
  });
}
