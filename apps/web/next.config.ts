import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone server (only the deps actually
  // used at runtime) — keeps the production Docker image small.
  output: "standalone",
  // Lets the dev server accept requests (including the HMR websocket) fronted by the local
  // Caddy reverse proxy at https://local.bhavano.com — without this, Next.js's cross-site-dev
  // protection 403s any /_next/* request whose Origin isn't localhost or the bound host.
  allowedDevOrigins: ["local.bhavano.com"],
  experimental: {
    // Server Actions cap request bodies at 1MB by default, which a single 5MB screenshot on the
    // Contact Us form blows past before any of our code runs. Sized for the form's own ceiling
    // (3 x 5MB, 10MB total) plus field overhead — see docs/plans/contact-us-support-form.md.
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    // Listing photos are served from the R2-backed CDN (see docs/plans/photo-uploads-r2-cdn.md).
    // Hardcoded rather than read from an env var here — next.config.ts's `images` option is
    // resolved at build time, and this app's Docker build doesn't currently pass NEXT_PUBLIC_*
    // vars in as build args, so an env-var lookup here wouldn't reliably take effect anyway.
    remotePatterns: [{ protocol: "https", hostname: "cdn.bhavano.com" }],
  },
};

export default nextConfig;
