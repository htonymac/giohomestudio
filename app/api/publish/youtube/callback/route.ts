// GET /api/publish/youtube/callback — OAuth2 callback from Google
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/modules/publisher/youtube";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No authorization code" }, { status: 400 });
  }

  const success = await exchangeCode(code);
  if (success) {
    // Redirect back to settings page with success message
    return NextResponse.redirect(new URL("/dashboard/settings?youtube=connected", req.url));
  }
  return NextResponse.redirect(new URL("/dashboard/settings?youtube=failed", req.url));
}
