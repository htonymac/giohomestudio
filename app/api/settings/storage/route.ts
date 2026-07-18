// GET /api/settings/storage — returns the current effective storage provider ("local" | "r2")
// PUT /api/settings/storage {provider:"local"|"r2"} — flips it live, no restart / redeploy.
//
// Writes <storagePath>/config/storage-settings.json, which src/lib/storage/index.ts reads
// (TTL-cached) ahead of the STORAGE_PROVIDER env var. Henry 2026-07-17: in-app R2 on/off toggle.

import { NextRequest, NextResponse } from "next/server";
import { getStorageProviderSetting, setStorageProviderSetting } from "@/lib/storage";

export async function GET() {
  return NextResponse.json({ provider: getStorageProviderSetting() });
}

export async function PUT(req: NextRequest) {
  let body: { provider?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.provider !== "local" && body.provider !== "r2") {
    return NextResponse.json({ error: "provider must be 'local' or 'r2'" }, { status: 400 });
  }

  setStorageProviderSetting(body.provider);
  return NextResponse.json({ ok: true, provider: body.provider });
}
