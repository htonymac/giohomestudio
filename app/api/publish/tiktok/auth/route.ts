import { NextResponse } from "next/server";
import { getTikTokAuthUrl } from "@/modules/publisher/tiktok";

export async function GET() {
  const url = getTikTokAuthUrl();
  if (!url) {
    return NextResponse.json({ error: "TikTok not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env" }, { status: 503 });
  }
  return NextResponse.redirect(url);
}
