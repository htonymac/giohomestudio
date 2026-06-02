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
  // Henry 2026-06-01: Next.js v16 Turbopack 404s the children-planner page's
  // main 291KB chunk despite the file being on disk and referenced in the
  // page RSC. Cause unclear — all other (smaller) chunks for the same route
  // serve fine. `fallback` rewrites only fire when the original path 404s,
  // so working chunks are untouched and broken chunks get rescued by our
  // custom route at /api/_chunk-fallback.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: "/_next/static/chunks/:path*", destination: "/api/_chunk-fallback/:path*" },
      ],
    };
  },
};

export default nextConfig;
