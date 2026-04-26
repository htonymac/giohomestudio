// GET /api/credits/transactions?limit=50
// Returns the most recent credit transactions for the default user.

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultUser } from "@/modules/credits";

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const parsed = limitParam ? parseInt(limitParam, 10) : 50;
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50;

    const user = await getDefaultUser();

    const transactions = await prisma.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ userId: user.id, transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
