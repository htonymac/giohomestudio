// POST /api/unlock — verify code, set cookie, redirect target.
// Henry 2026-06-03: paired with middleware.ts gate.

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code, to } = await req.json() as { code?: string; to?: string };
    const expected = process.env.ACCESS_CODE;
    if (!expected) {
      return NextResponse.json({ ok: false, error: "Access lock disabled" }, { status: 503 });
    }
    if (!code || code.trim() !== expected) {
      return NextResponse.json({ ok: false, error: "Wrong code" }, { status: 401 });
    }
    const safeTo = (to && to.startsWith("/") && !to.startsWith("//")) ? to : "/dashboard/children-planner";
    const res = NextResponse.json({ ok: true, to: safeTo });
    res.cookies.set("andio_access", expected, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "unlock failed" }, { status: 500 });
  }
}
