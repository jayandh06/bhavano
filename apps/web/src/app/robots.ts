import type { MetadataRoute } from "next";
import { buildMarket, robotsSitemaps } from "@/lib/marketRobots";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

export default function robots(): MetadataRoute.Robots {
  // A market that is not launched (the US) disallows everything and lists no sitemap. Crawlers only read the host-root robots.txt
  // (India's), so this one is inert under /us, but it must not say "allow" if it is ever fetched.
  if (!buildMarket().indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /auth is the Google popup's start and completion routes — machinery, not pages. Hitting
      // /auth/google from a crawl would start an OAuth handshake for nobody.
      disallow: ["/post", "/favourites", "/messages", "/my-listings", "/profile", "/auth"],
    },
    sitemap: robotsSitemaps(SITE_URL),
  };
}
