// GioHomeStudio — GET /api/review
// Returns items pending review.

import { NextResponse } from "next/server";
import { getPendingReviewItems } from "@/modules/review";

export async function GET() {
  const items = await getPendingReviewItems();
  return NextResponse.json({ items });
}
