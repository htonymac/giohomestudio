// POST /api/asset/[id]/confirm-upload
// Client calls after successful PUT — flips status PENDING_UPLOAD → READY,
// optionally back-fills sizeBytes from actual upload.
//
// Wave 3 Phase 4 (2026-05-23).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { rateLimit, RateLimitError, identityFromRequest } from "@/lib/rate-limit";
import { assertCanWrite, PermissionDeniedError } from "@/lib/asset-permission";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    rateLimit("confirm-upload", identityFromRequest(req, userId), { perMinute: 60 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "asset id required" }, { status: 400 });

    const asset = await prisma.contentItem.findUnique({
      where: { id },
      select: { id: true, ownerId: true, visibility: true, r2Key: true, status: true },
    });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    assertCanWrite({ id: asset.id, ownerId: asset.ownerId, visibility: asset.visibility }, { userId });

    if (!asset.r2Key) {
      return NextResponse.json({ error: "Asset has no r2Key — not a sign-put asset" }, { status: 400 });
    }

    // Verify upload actually landed
    const storage = getStorage();
    const exists = await storage.exists(asset.r2Key);
    if (!exists) {
      return NextResponse.json({ error: "Upload not found in storage", r2Key: asset.r2Key }, { status: 409 });
    }
    const actualSize = await storage.size(asset.r2Key);

    // ContentStatus enum: PENDING → IN_REVIEW means "uploaded, awaiting user action"
    const updated = await prisma.contentItem.update({
      where: { id },
      data: {
        status: "IN_REVIEW",
        ...(actualSize !== null ? { sizeBytes: BigInt(actualSize) } : {}),
      },
      select: { id: true, status: true, sizeBytes: true, r2Key: true },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      sizeBytes: updated.sizeBytes !== null ? Number(updated.sizeBytes) : null,
      r2Key: updated.r2Key,
    });
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
