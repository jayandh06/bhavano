import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/post", "/favourites", "/messages", "/my-listings", "/profile"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
