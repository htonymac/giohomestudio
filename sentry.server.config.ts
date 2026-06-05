// Sentry Node.js server config. Installed 2026-06-05.

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.APP_ENV || (process.env.NODE_ENV === "production" ? "prod" : "dev"),
    tracesSampleRate: 0.1,
    // Lower noise: don't capture expected 401s from site-lock unlock flow.
    beforeSend(event) {
      const msg = event.message || event.exception?.values?.[0]?.value || "";
      if (/unlock|401|cookie/i.test(msg)) return null;
      return event;
    },
  });
}
