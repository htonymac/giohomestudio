import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GioHomeStudio — localhost-first config
  // serverExternalPackages moved to top-level in Next.js 15+
  serverExternalPackages: ["fluent-ffmpeg", "@prisma/client", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
  // Disable image optimization for local dev (no CDN)
  images: {
    unoptimized: true,
  },
  // Next.js 16 blocks cross-origin requests to dev resources (_next/webpack-hmr + client bundle)
  // by default. Without this, accessing via andiostudio.com (CF Tunnel → localhost:3200)
  // breaks React hydration — page renders SSR but client bundle never loads → no buttons fire.
  // Fix added 2026-05-24 after Henry reported "no buttons firing".
  allowedDevOrigins: ["andiostudio.com", "www.andiostudio.com"],
};

// Sentry wrap — H2 of 12-hour run, installed 2026-06-05.
// Lazy require to avoid Next.js compiled-config module resolution issues with pnpm
// (next.config.compiled.js sits at repo root and pnpm's symlinked node_modules
// trip the require). Only wraps when SENTRY_AUTH_TOKEN is set.
let finalConfig = nextConfig;
if (process.env.SENTRY_AUTH_TOKEN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withSentryConfig } = require("@sentry/nextjs");
    finalConfig = withSentryConfig(nextConfig, {
      org: "henmac",
      project: "ghs-web",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      reactComponentAnnotation: { enabled: false },
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch (e) {
    console.warn("[next.config] Sentry wrap skipped:", e instanceof Error ? e.message : String(e));
  }
}
export default finalConfig;
