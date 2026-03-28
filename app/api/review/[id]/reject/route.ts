// GioHomeStudio — POST /api/review/[id]/reject

import { NextRequest, NextResponse } from "next/server";
import { rejectContent } from "@/modules/review";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await rejectContent(id, body.note);
  if (!result.success) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
