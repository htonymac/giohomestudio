// GioHomeStudio — POST /api/review/[id]/approve

import { NextRequest, NextResponse } from "next/server";
import { approveContent } from "@/modules/review";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await approveContent(id, body.note);
  if (!result.success) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
