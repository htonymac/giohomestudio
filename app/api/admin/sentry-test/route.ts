// GET /api/admin/sentry-test — fires a controlled error to verify Sentry capture.
//
// Use this ONCE after installing Sentry to confirm DSN + instrumentation work
// end to end. The handler throws on purpose; instrumentation.ts's onRequestError
// captures it; the error appears in sentry.io/organizations/henmac/issues.
//
// Auth: ADMIN_TOKEN env match (so a random user can't spam Sentry quota).
//
// Sample:
//   curl -H "X-Admin-Token: $ADMIN_TOKEN" https://andiostudio.com/api/admin/sentry-test?kind=throw
//   curl -H "X-Admin-Token: $ADMIN_TOKEN" https://andiostudio.com/api/admin/sentry-test?kind=capture
//
// kind=throw    → throws; caught by Sentry's onRequestError hook
// kind=capture  → calls Sentry.captureException directly (no throw)

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = req.headers.get("x-admin-token");
  return bearer === expected || headerToken === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "capture";
  const tag = `sentry-test-${Date.now()}`;

  if (kind === "throw") {
    // Sentry's onRequestError hook in instrumentation.ts catches this.
    throw new Error(`[sentry-test:throw] ${tag} — controlled test from /api/admin/sentry-test`);
  }

  // Default: explicit capture
  const eventId = Sentry.captureException(new Error(`[sentry-test:capture] ${tag} — explicit Sentry.captureException test`));
  await Sentry.flush(3000).catch(() => {});

  return NextResponse.json({
    ok: true,
    tag,
    kind,
    eventId,
    message: "Check sentry.io/organizations/henmac/issues for this event within ~30 seconds.",
  });
}
