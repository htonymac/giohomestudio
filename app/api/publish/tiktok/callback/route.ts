import { NextRequest, NextResponse } from "next/server";
import { exchangeTikTokCode } from "@/modules/publisher/tiktok";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });
  const ok = await exchangeTikTokCode(code);
  return NextResponse.redirect(new URL(`/dashboard/settings?tiktok=${ok ? "connected" : "failed"}`, req.url));
}
