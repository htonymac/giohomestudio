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
  experimental: {
    // Next.js 16 caps request bodies at 10 MB by default (config-shared.js
    // proxyClientMaxBodySize: 10485760) — any upload over 10 MB got its body cut and
    // req.formData() threw → "Invalid multipart form" on /api/v2v/upload. 512 MB
    // covers the 500 MB route-level cap. Found 2026-07-13 (Henry's 13.6 MB Kling
    // clip rejected; ≤10 MB files passed).
    proxyClientMaxBodySize: 512 * 1024 * 1024,
  },
};

// Sentry: wrap REMOVED 2026-06-05 — pnpm hoist trap caused next.config.compiled.js
// at repo root to fail resolving @sentry/nextjs. The SDK still runs fine via
// instrumentation.ts (server boot hook) — wrap was only for source-map upload at
// build time. Re-add later via a separate next.config when we move to next build.
export default nextConfig;
