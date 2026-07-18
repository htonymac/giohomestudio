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

// Serve HTML pages with no-store so a new deploy shows up on a normal reload —
// Next statically-optimises some pages with `s-maxage=31536000` (1 year), which
// made every update require a hard-refresh (Henry 2026-07-17). Hashed assets
// (/_next/static/*) and API routes keep their own caching — only PAGES are no-store.
function pageResponse(req: NextRequest, res: NextResponse): NextResponse {
  const { pathname } = req.nextUrl;
  const isAssetOrApi =
    pathname.startsWith("/_next") || pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(pathname);
  if (!isAssetOrApi) res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

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
  if (!code) return pageResponse(req, NextResponse.next());

  const { pathname } = req.nextUrl;
  if (PASS_THROUGH.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Henry 2026-06-04: pass through internal localhost requests. The detached
  // assemble worker, the children-narration -> /api/tts inner call, and
  // anything else where the server hits itself comes from 127.0.0.1 — those
  // don't have the browser cookie. Was: 401 -> 'AUTH IS STOPP ASSEMBLE'.
  const host = req.headers.get("host") || "";
  if (host.startsWith("127.0.0.1") || host.startsWith("localhost")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("andio_access");
  if (cookie?.value === code) {
    return pageResponse(req, NextResponse.next());
  }

  // Henry 2026-06-04: APIs return 401 JSON, pages get redirected. Was: APIs
  // also got redirected -> client received HTML, tried to parse as JSON,
  // SAVE silently failed with no error visible to user.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required. Reload the page and re-enter the access code." },
      { status: 401 }
    );
  }

  // Redirect HTML page requests to the unlock page.
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("to", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
