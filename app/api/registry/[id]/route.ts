// GioHomeStudio — GET /api/registry/[id]

import { NextRequest, NextResponse } from "next/server";
import { getContentItem, getContentVersions } from "@/modules/content-registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getContentItem(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await getContentVersions(id);
  return NextResponse.json({ item, versions });
}
