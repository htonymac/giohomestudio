// Sentry edge runtime config (middleware). Installed 2026-06-05.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.APP_ENV || (process.env.NODE_ENV === "production" ? "prod" : "dev"),
    tracesSampleRate: 0.1,
  });
}
