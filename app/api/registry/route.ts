// GioHomeStudio — GET /api/registry
// Returns content items from the registry.

import { NextRequest, NextResponse } from "next/server";
import { listContentItems } from "@/modules/content-registry";
import type { ContentStatus } from "@/types/content";

const VALID_STATUSES = new Set<ContentStatus>([
  "PENDING", "ENHANCING", "GENERATING_VIDEO", "GENERATING_VOICE",
  "GENERATING_MUSIC", "MERGING", "IN_REVIEW", "APPROVED",
  "REJECTED", "FAILED", "PUBLISHED", "ARCHIVED",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const mode = searchParams.get("mode") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  if (rawStatus && !VALID_STATUSES.has(rawStatus as ContentStatus)) {
    return NextResponse.json({ error: `Invalid status: ${rawStatus}` }, { status: 400 });
  }

  const status = rawStatus as ContentStatus | null;
  const result = await listContentItems({ status: status ?? undefined, mode, search, limit, offset });
  return NextResponse.json({ items: result.items, total: result.total });
}
