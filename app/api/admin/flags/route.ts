// POST /api/admin/flags  → { key, enabled } toggles a feature flag
// GET  /api/admin/flags  → list all flags (known + DB-only)
//
// Auth: requires ADMIN_TOKEN env var match (Bearer or X-Admin-Token header).
// H4 of 12-hour run (2026-06-05).

import { NextRequest, NextResponse } from "next/server";
import { listFlags, setFlag } from "@/lib/feature-flags";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = req.headers.get("x-admin-token");
  return bearer === expected || headerToken === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const flags = await listFlags();
  return NextResponse.json({ flags });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { key, enabled, by } = body as { key?: string; enabled?: boolean; by?: string };
    if (!key || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "key and enabled (boolean) required" }, { status: 400 });
    }
    await setFlag(key, enabled, by ?? "admin");
    return NextResponse.json({ ok: true, key, enabled });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
