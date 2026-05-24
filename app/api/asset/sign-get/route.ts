// GET /api/asset/sign-get?assetId=<id>&quality=preview|full
// Returns: { url, expiresInSec }
//
// Wave 3 Phase 4 (2026-05-23) — owner check + rate-limit + signed URL via storage provider.
//
// Tier-quality routing (Phase 7 deeper):
//   - quality=preview (default) — always allowed for any authed user who can read the asset
//   - quality=full              — requires paid tier OR ownership
// For now we honor `quality=full` for owner regardless of tier. Tier enforcement lands Phase 7.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { canRead, PermissionDeniedError } from "@/lib/asset-permission";
import { rateLimit, RateLimitError, identityFromRequest } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    rateLimit("sign-get", identityFromRequest(req, userId), { perMinute: 100 });

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");
    const quality = (searchParams.get("quality") ?? "preview") as "preview" | "full";

    if (!assetId) {
      return NextResponse.json({ error: "assetId required" }, { status: 400 });
    }

    const asset = await prisma.contentItem.findUnique({
      where: { id: assetId },
      select: {
        id: true, ownerId: true, visibility: true, r2Key: true, previewKey: true,
        videoPath: true, mergedOutputPath: true, voicePath: true, musicPath: true,
      },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (!canRead({ id: asset.id, ownerId: asset.ownerId, visibility: asset.visibility }, { userId })) {
      throw new PermissionDeniedError(asset.id, "read");
    }

    // Pick the key: full = r2Key (or local fallback), preview = previewKey (fall back to r2Key)
    let key: string | null = null;
    if (quality === "full") {
      key = asset.r2Key
        ?? asset.mergedOutputPath
        ?? asset.videoPath
        ?? asset.voicePath
        ?? asset.musicPath
        ?? null;
    } else {
      key = asset.previewKey ?? asset.r2Key ?? asset.videoPath ?? null;
    }
    if (!key) {
      return NextResponse.json({ error: "Asset has no storage key", quality }, { status: 410 });
    }

    const storage = getStorage();
    const ttlMin = 15;
    const url = await storage.signGet(key, { ttlMinutes: ttlMin });
    return NextResponse.json({ url, expiresInSec: ttlMin * 60, key, quality, provider: storage.name });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message, retryAfterSec: err.retryAfterSec }, { status: 429 });
    }
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
