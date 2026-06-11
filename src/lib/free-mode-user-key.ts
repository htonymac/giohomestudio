// ─────────────────────────────────────────────────────────────────────────────
// Anonymous user identity for Free Mode.
//
// THE PROBLEM (Henry 2026-06-08):
//   Earlier code derived a userKey from `sha256(ip + "-free-mode")`. When the
//   user's public IP rotated (ISP change, VPN toggle, mobile network, router
//   restart) the new userKey didn't match any previously-saved session — the
//   sidebar would say "No sessions yet" even though their old chats were still
//   in the DB under their old IP-hash.
//
// THE FIX:
//   Use a server-set httpOnly cookie that lives in the user's browser. JS
//   CANNOT read it (no risk of accidentally mixing the identity into scene or
//   session payloads, which was Henry's specific concern about a localStorage
//   approach). Server reads the cookie if present; falls back to the old IP
//   hash if absent so existing IP-tied sessions still work for users who
//   never set the cookie.
//
// HOW TO USE THIS MODULE:
//   const { userKey, setCookieOnResponse } = resolveUserKey(request);
//   ... do your DB work with `userKey` ...
//   const response = NextResponse.json(payload);
//   setCookieOnResponse(response);   // no-op if the cookie was already present
//   return response;
//
// MIGRATION PATH for users with old IP-hash sessions:
//   We do NOT auto-claim old sessions on first cookie set — the user might be
//   on a public network where someone else's IP-hash matches. A future endpoint
//   `/api/free-mode/sessions/claim` can let the user opt in to merging an old
//   userKey into their cookie-set one. For now: on first cookie set the user
//   starts fresh; old sessions remain in the DB under the IP hash.
// ─────────────────────────────────────────────────────────────────────────────

import type { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

const COOKIE_NAME = "ghs_freemode_user";
// 5 years — far longer than any IP-stable window. The cookie is essentially
// the user's persistent anonymous identity; we want it to outlive normal
// browser cache clears so chats reappear after a casual "clear cache" sweep
// that doesn't include cookies.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

function ipHashFallback(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip        = forwarded?.split(",")[0].trim() ?? "unknown";
  return createHash("sha256").update(ip + "-free-mode").digest("hex").slice(0, 32);
}

export interface ResolvedUserKey {
  /** The userKey to use for DB lookups in this request. */
  userKey: string;
  /**
   * Attach the cookie to the outgoing response. No-op if the cookie was
   * already on the incoming request. Safe to call multiple times.
   */
  setCookieOnResponse: (res: NextResponse) => void;
}

export function resolveUserKey(req: NextRequest): ResolvedUserKey {
  // Henry 2026-06-11 — "free mode history vanish AGAIN".
  // The cookie identity is fragile: any cookie loss (browser cleanup, profile
  // switch, the first-load parallel-request race where several responses each
  // mint a different key) silently orphans every session under the old key.
  // Found live: Henry's browser carried key fd2bd080… while his 11 sessions
  // sat under a53199a5… → sidebar empty, data intact.
  //
  // The whole site is single-user behind the ACCESS_CODE gate (middleware.ts),
  // so when ACCESS_CODE is set the free-mode identity is DERIVED FROM IT —
  // stable across cookie loss, browsers, devices, and restarts. Anyone who can
  // reach these APIs has already passed the gate, so sharing one owner key is
  // correct by construction. Cookie path below remains for a future
  // ACCESS_CODE-less multi-user mode.
  const accessCode = process.env.ACCESS_CODE;
  if (accessCode) {
    return {
      userKey: createHash("sha256").update(accessCode + "-freemode-owner").digest("hex").slice(0, 32),
      setCookieOnResponse: () => { /* no-op — identity is not cookie-bound */ },
    };
  }

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;

  if (cookieValue && /^[a-f0-9]{32}$/.test(cookieValue)) {
    // Cookie present and well-formed — use it. No need to set anything.
    return {
      userKey: cookieValue,
      setCookieOnResponse: () => { /* no-op */ },
    };
  }

  // No cookie yet — mint a fresh random userKey and arrange to set the cookie
  // on the response. Falls back to IP hash if we can't generate randomness
  // (extremely unlikely on Node, included for completeness).
  let fresh: string;
  try {
    fresh = randomBytes(16).toString("hex"); // 32 hex chars
  } catch {
    fresh = ipHashFallback(req);
  }

  return {
    userKey: fresh,
    setCookieOnResponse: (res) => {
      res.cookies.set(COOKIE_NAME, fresh, {
        httpOnly: true,
        sameSite: "lax",
        secure:   process.env.NODE_ENV === "production",
        path:     "/",
        maxAge:   COOKIE_MAX_AGE_SECONDS,
      });
    },
  };
}

/**
 * Back-compat IP-hash userKey for endpoints that haven't migrated yet. Returns
 * the SAME hash format the old inline `getUserKey` produced so existing
 * sessions stay reachable.
 */
export function legacyIpHashUserKey(req: NextRequest): string {
  return ipHashFallback(req);
}
