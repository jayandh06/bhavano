import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /auth is the Google popup's start and completion routes — machinery, not pages. Hitting
      // /auth/google from a crawl would start an OAuth handshake for nobody.
      disallow: ["/post", "/favourites", "/messages", "/my-listings", "/profile", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
