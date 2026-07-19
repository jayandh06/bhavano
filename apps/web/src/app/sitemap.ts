import type { MetadataRoute } from "next";
import { fetchListingsSitemap } from "@/lib/bff";
import { buildBrowsePath, buildListingPath } from "@/lib/listingPath";
import { transactionGroupFor } from "@/lib/seoRoute";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await fetchListingsSitemap();

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}${buildListingPath(listing)}`,
    lastModified: listing.updatedAt,
  }));

  // City-root, city+area, city+group, and city+group+category entries — one per distinct
  // combination actually present in the data (not a combinatorial city×area×group×category×facet
  // explosion) — the direct SEO payoff of the area-first city hierarchy: a real, indexable
  // landing page per locality ("apartments for rent in Koramangala"), not just per city.
  const cityPaths = new Map<string, string>();
  const areaPaths = new Map<string, string>();
  const groupPaths = new Map<string, string>();
  const categoryPaths = new Map<string, string>();

  for (const listing of listings) {
    const group = transactionGroupFor(listing.transactionType);

    if (!cityPaths.has(listing.cityName)) {
      cityPaths.set(listing.cityName, buildBrowsePath({ cityName: listing.cityName }));
    }

    const areaKey = `${listing.cityName}|${listing.area}`;
    if (!areaPaths.has(areaKey)) {
      areaPaths.set(areaKey, buildBrowsePath({ cityName: listing.cityName, areaName: listing.area }));
    }

    const groupKey = `${listing.cityName}|${group}`;
    if (!groupPaths.has(groupKey)) {
      groupPaths.set(groupKey, buildBrowsePath({ cityName: listing.cityName, transactionGroup: group }));
    }

    const categoryKey = `${groupKey}|${listing.category}`;
    if (!categoryPaths.has(categoryKey)) {
      categoryPaths.set(categoryKey, buildBrowsePath({ cityName: listing.cityName, transactionGroup: group, category: listing.category }));
    }
  }

  const browseEntries: MetadataRoute.Sitemap = [
    ...cityPaths.values(),
    ...areaPaths.values(),
    ...groupPaths.values(),
    ...categoryPaths.values(),
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  return [{ url: SITE_URL, lastModified: new Date() }, ...browseEntries, ...listingEntries];
}
