// POST /api/asset/sign-put
// Body: { type: "image"|"video"|"audio", projectId?, mimeType, sizeBytes, prefix?: "uploads"|"characters"|"generated/images"|... }
// Returns: { uploadUrl, assetId, r2Key, expiresInSec, provider }
//
// Wave 3 Phase 4 (2026-05-23).
// Pattern: create ContentItem row in Postgres FIRST with status=PENDING_UPLOAD,
// then return signed PUT URL. Client uploads directly to R2 (or via /api/media/upload/...
// on local provider), then POSTs /api/asset/<id>/confirm-upload to flip status → READY.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorage, STORAGE_PREFIXES, buildKey, type StoragePrefix } from "@/lib/storage";
import { rateLimit, RateLimitError, identityFromRequest } from "@/lib/rate-limit";

// Per-tier file size cap (Phase 7 will move to DB-backed Tier model).
const TIER_CAPS: Record<string, { maxFileSizeBytes: number; maxVideoDurationSec: number }> = {
  free:     { maxFileSizeBytes: 50_000_000,    maxVideoDurationSec: 30 },
  standard: { maxFileSizeBytes: 500_000_000,   maxVideoDurationSec: 180 },
  pro:      { maxFileSizeBytes: 2_000_000_000, maxVideoDurationSec: 600 },
  premium:  { maxFileSizeBytes: Number.MAX_SAFE_INTEGER, maxVideoDurationSec: 7200 },
};

function cuid(): string {
  return "a" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    rateLimit("sign-put", identityFromRequest(req, userId), { perMinute: 10 });

    const body = await req.json() as {
      type?: "image" | "video" | "audio";
      projectId?: string;
      mimeType?: string;
      sizeBytes?: number;
      prefix?: string;
      filename?: string;
    };
    const { type, projectId, mimeType, sizeBytes, filename } = body;
    if (!type || !mimeType || typeof sizeBytes !== "number") {
      return NextResponse.json({ error: "type, mimeType, sizeBytes required" }, { status: 400 });
    }

    // Tier cap check (TODO Phase 7: pull tier from User/Subscription)
    const userTier = "standard"; // hardcoded until Phase 7
    const caps = TIER_CAPS[userTier] ?? TIER_CAPS.standard;
    if (sizeBytes > caps.maxFileSizeBytes) {
      return NextResponse.json({
        error: `File too large for ${userTier} tier`,
        sizeBytes,
        maxAllowed: caps.maxFileSizeBytes,
      }, { status: 413 });
    }

    // Pick prefix based on type
    let prefix: StoragePrefix;
    if (type === "video") prefix = STORAGE_PREFIXES.generatedVideo;
    else if (type === "image") prefix = STORAGE_PREFIXES.generatedImages;
    else prefix = STORAGE_PREFIXES.uploads;
    // Allow caller override (e.g. characters/, stories/)
    if (body.prefix && Object.values(STORAGE_PREFIXES).includes(body.prefix as StoragePrefix)) {
      prefix = body.prefix as StoragePrefix;
    }

    const ext = filename?.match(/\.[a-z0-9]{2,5}$/i)?.[0]
      ?? (mimeType.startsWith("video/") ? ".mp4"
        : mimeType.startsWith("image/") ? ".png"
        : mimeType.startsWith("audio/") ? ".mp3"
        : ".bin");
    const id = cuid();
    const r2Key = buildKey(prefix, `${id}${ext}`);

    // Create ContentItem row FIRST (PENDING_UPLOAD)
    const asset = await prisma.contentItem.create({
      data: {
        id,
        mode: "FREE",
        status: "PENDING",
        originalInput: filename ?? `upload-${type}`,
        ownerId: userId,
        r2Key,
        sizeBytes: BigInt(sizeBytes),
        visibility: "private",
        storageProvider: process.env.STORAGE_PROVIDER === "r2" ? "r2" : "local",
      },
    });

    const storage = getStorage();
    const ttlMin = 15;
    const uploadUrl = await storage.signPut(r2Key, { ttlMinutes: ttlMin, contentType: mimeType });

    return NextResponse.json({
      uploadUrl,
      assetId: asset.id,
      r2Key,
      expiresInSec: ttlMin * 60,
      provider: storage.name,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message, retryAfterSec: err.retryAfterSec }, { status: 429 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
