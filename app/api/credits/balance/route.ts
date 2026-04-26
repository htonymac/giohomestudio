// GET /api/credits/balance
// Returns the default user's current credit balance + tier.
// Phase 2: single default user, real auth deferred to later phase.

import { NextResponse } from "next/server";
import { getDefaultUser, getBalance } from "@/modules/credits";

export async function GET() {
  try {
    const user = await getDefaultUser();
    const { balance, tier } = await getBalance(user.id);
    return NextResponse.json({ userId: user.id, balance, tier });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
