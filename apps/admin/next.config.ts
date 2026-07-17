import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone server (only the deps actually
  // used at runtime) — keeps the production Docker image small.
  output: "standalone",
};

export default nextConfig;
