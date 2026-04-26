// GET /api/publish/youtube/auth — redirect to Google OAuth2 consent screen
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/modules/publisher/youtube";

export async function GET() {
  const url = getAuthUrl();
  if (!url) {
    return NextResponse.json(
      { error: "YouTube not configured. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env" },
      { status: 503 }
    );
  }
  return NextResponse.redirect(url);
}
