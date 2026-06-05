// Sentry browser config. Installed 2026-06-05 (H2 of 12-hour run).
// DSN sourced from env at build time. Safe to commit — DSN is public per Sentry design.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV || (process.env.NODE_ENV === "production" ? "prod" : "dev"),
    tracesSampleRate: 0.1,           // 10% of transactions traced
    replaysSessionSampleRate: 0,     // off — saves bandwidth
    replaysOnErrorSampleRate: 1.0,   // record session when an error occurs
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Don't send events while running e2e tests via Playwright debug Chrome.
    beforeSend(event) {
      if (typeof window !== "undefined" && /(playwright|HeadlessChrome)/i.test(navigator.userAgent || "")) return null;
      return event;
    },
  });
}
