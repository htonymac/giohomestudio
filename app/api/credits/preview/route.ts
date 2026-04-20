// GET /api/credits/preview?modelId=<id>
// Returns the credit + USD cost of a generation BEFORE it runs.
// UI calls this to show a cost chip next to Generate buttons.

import { NextResponse, NextRequest } from "next/server";
import { previewCost } from "@/modules/credits";

export async function GET(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId");
  if (!modelId) {
    return NextResponse.json({ error: "modelId query param required" }, { status: 400 });
  }
  try {
    const preview = previewCost(modelId);
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
