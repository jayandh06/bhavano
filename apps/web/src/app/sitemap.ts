import type { MetadataRoute } from "next";
import { fetchListingsSitemap } from "@/lib/bff";
import { buildBrowsePath, buildListingPath } from "@/lib/listingPath";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await fetchListingsSitemap();

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}${buildListingPath(listing)}`,
    lastModified: listing.updatedAt,
  }));

  // One browse-landing entry per distinct (transactionType, category, city) combination —
  // locality-level is omitted here to avoid a low-value explosion at current data volume.
  const seen = new Set<string>();
  const browseEntries: MetadataRoute.Sitemap = [];
  for (const listing of listings) {
    const key = `${listing.transactionType}|${listing.category}|${listing.cityName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    browseEntries.push({
      url: `${SITE_URL}${buildBrowsePath(listing.transactionType, listing.category, listing.cityName)}`,
      lastModified: listing.updatedAt,
    });
  }

  return [{ url: SITE_URL, lastModified: new Date() }, ...browseEntries, ...listingEntries];
}
