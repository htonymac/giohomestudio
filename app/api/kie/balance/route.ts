// GET /api/kie/balance — returns current Kie.ai credit balances
// Used by admin panel to show remaining free credits.

import { NextResponse } from "next/server";
import { kieGetBalance } from "@/lib/generation/gateways/kie";

export async function GET() {
  const result = await kieGetBalance();
  return NextResponse.json({
    ok: !result.error,
    credits: result.credits,
    deepseekCredits: result.deepseekCredits,
    error: result.error,
  });
}
