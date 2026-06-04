// Henry 2026-06-03: site-wide soft lock.
// Anyone hitting andiostudio.com without the `andio_access` cookie is
// redirected to /unlock. Cookie is set by /api/unlock when they submit the
// correct ACCESS_CODE.
//
// Whitelist (no lock):
//   - /_next/*           — static + chunks
//   - /favicon, /icon    — branding
//   - /unlock            — the gate itself
//   - /api/unlock        — gate endpoint
//   - /api/health        — keepalive / probe
//
// To DISABLE the lock entirely: unset ACCESS_CODE in .env (or set to empty).

import { NextRequest, NextResponse } from "next/server";

const PASS_THROUGH = [
  "/_next",
  "/favicon",
  "/icon",
  "/unlock",
  "/api/unlock",
  "/api/health",
];

export function middleware(req: NextRequest) {
  // No ACCESS_CODE = lock disabled.
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PASS_THROUGH.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("andio_access");
  if (cookie?.value === code) {
    return NextResponse.next();
  }

  // Redirect to unlock page, preserving where the user was going.
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("to", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
