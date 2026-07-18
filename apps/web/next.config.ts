import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone server (only the deps actually
  // used at runtime) — keeps the production Docker image small.
  output: "standalone",
  images: {
    // Listing photos are served from the R2-backed CDN (see docs/plans/photo-uploads-r2-cdn.md).
    // Hardcoded rather than read from an env var here — next.config.ts's `images` option is
    // resolved at build time, and this app's Docker build doesn't currently pass NEXT_PUBLIC_*
    // vars in as build args, so an env-var lookup here wouldn't reliably take effect anyway.
    remotePatterns: [{ protocol: "https", hostname: "cdn.bhavano.com" }],
  },
};

export default nextConfig;
