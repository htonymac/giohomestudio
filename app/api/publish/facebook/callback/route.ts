import { NextRequest, NextResponse } from "next/server";
import { exchangeFacebookCode } from "@/modules/publisher/facebook";

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });
  const ok = await exchangeFacebookCode(code);
  return NextResponse.redirect(new URL(`/dashboard/settings?facebook=${ok ? "connected" : "failed"}`, req.url));
}
