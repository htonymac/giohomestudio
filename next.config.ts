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
// Only wraps when SENTRY_AUTH_TOKEN is present so dev builds don't try to upload
// source maps without credentials.
import { withSentryConfig } from "@sentry/nextjs";

const hasSentryAuth = !!process.env.SENTRY_AUTH_TOKEN;

export default hasSentryAuth
  ? withSentryConfig(nextConfig, {
      org: "henmac",
      project: "ghs-web",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      reactComponentAnnotation: { enabled: false },
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;
