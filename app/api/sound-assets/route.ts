// POST /api/sound-assets — Register a sound asset with license metadata
// GET  /api/sound-assets — List sound assets (filterable by bucket/category/license)
//
// 3-Bucket Policy enforced:
// Bucket 1: "owned" — fully owned/custom-created — always allowed
// Bucket 2: "cc0" — public domain — allowed, tracked
// Bucket 3: "cc_by" — Creative Commons Attribution — allowed ONLY with attribution
// BLOCKED: "cc_by_nc" — NOT allowed in commercial production
// BLOCKED: "unknown" — NOT allowed in any production

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_BUCKETS = ["owned", "cc0", "cc_by"];
const BLOCKED_BUCKETS = ["cc_by_nc", "unknown"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Enforce 3-bucket policy
    const bucket = body.usageBucket ?? body.licenseType ?? "unknown";
    if (BLOCKED_BUCKETS.includes(bucket)) {
      return NextResponse.json({
        error: `License type "${bucket}" is NOT allowed in production. Only owned, CC0, and CC BY (with attribution) are allowed.`,
        blocked: true,
        reason: bucket === "cc_by_nc"
          ? "CC BY-NC sounds cannot be used in commercial production. Find an alternative with CC0 or CC BY license."
          : "Unknown license sounds cannot be used in production. Verify the license before using.",
      }, { status: 403 });
    }

    const asset = await prisma.soundAsset.create({
      data: {
        title: body.title ?? "Untitled Sound",
        creatorName: body.creatorName ?? null,
        sourcePlatform: body.sourcePlatform ?? "internal",
        sourceUrl: body.sourceUrl ?? null,
        licenseType: body.licenseType ?? "owned",
        requiresAttribution: body.requiresAttribution ?? (bucket === "cc_by"),
        commercialAllowed: body.commercialAllowed ?? !BLOCKED_BUCKETS.includes(bucket),
        attributionText: body.attributionText ?? null,
        localFilename: body.localFilename ?? null,
        cacheStatus: body.cacheStatus ?? "local",
        usageBucket: bucket,
        tags: body.tags ?? null,
        duration: body.duration ?? null,
        qualityRating: body.qualityRating ?? null,
        category: body.category ?? "sfx",
        blocked: BLOCKED_BUCKETS.includes(bucket),
      },
    });

    return NextResponse.json({ asset });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const bucket = req.nextUrl.searchParams.get("bucket");
    const category = req.nextUrl.searchParams.get("category");
    const license = req.nextUrl.searchParams.get("license");

    const where: Record<string, unknown> = { blocked: false };
    if (bucket) where.usageBucket = bucket;
    if (category) where.category = category;
    if (license) where.licenseType = license;

    const assets = await prisma.soundAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Generate attribution block for CC BY assets
    const ccByAssets = assets.filter(a => a.requiresAttribution && a.attributionText);
    const creditsBlock = ccByAssets.length > 0
      ? ccByAssets.map(a => a.attributionText).join("\n")
      : null;

    return NextResponse.json({
      assets,
      count: assets.length,
      creditsBlock,
      bucketSummary: {
        owned: assets.filter(a => a.usageBucket === "owned").length,
        cc0: assets.filter(a => a.usageBucket === "cc0").length,
        cc_by: assets.filter(a => a.usageBucket === "cc_by").length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
