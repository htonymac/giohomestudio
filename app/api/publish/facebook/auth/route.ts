import { NextResponse } from "next/server";
import { getFacebookAuthUrl } from "@/modules/publisher/facebook";

export async function GET() {
  const url = getFacebookAuthUrl();
  if (!url) {
    return NextResponse.json({ error: "Facebook not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env" }, { status: 503 });
  }
  return NextResponse.redirect(url);
}
