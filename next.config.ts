import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GioHomeStudio — localhost-first config
  // serverExternalPackages moved to top-level in Next.js 15+
  serverExternalPackages: ["fluent-ffmpeg", "@prisma/client"],
  // Disable image optimization for local dev (no CDN)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
