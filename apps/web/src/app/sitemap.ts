import type { MetadataRoute } from "next";
import { fetchCities, fetchListingsSitemap } from "@/lib/bff";
import { buildBrowsePath, buildListingPath } from "@/lib/listingPath";
import { transactionGroupFor } from "@/lib/seoRoute";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, cities] = await Promise.all([fetchListingsSitemap(), fetchCities(undefined, true).catch(() => [])]);
  // The cities the ads target (`isPopular`) go first and rank above the rest. Google ignores
  // `priority`, Bing reads it; see docs/plans/focus-on-ad-target-cities.md.
  const topCityNames = new Set(cities.filter((city) => city.isPopular).map((city) => city.name));

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}${buildListingPath(listing)}`,
    lastModified: listing.updatedAt,
  }));

  // City-root, city+area, city+group, and city+group+category entries — one per distinct
  // combination actually present in the data (not a combinatorial city×area×group×category×facet
  // explosion) — the direct SEO payoff of the area-first city hierarchy: a real, indexable
  // landing page per locality ("apartments for rent in Koramangala"), not just per city.
  type BrowsePath = { path: string; cityName: string };
  const cityPaths = new Map<string, BrowsePath>();
  const areaPaths = new Map<string, BrowsePath>();
  const groupPaths = new Map<string, BrowsePath>();
  const categoryPaths = new Map<string, BrowsePath>();

  for (const listing of listings) {
    const group = transactionGroupFor(listing.transactionType);
    const { cityName } = listing;

    if (!cityPaths.has(cityName)) {
      cityPaths.set(cityName, { cityName, path: buildBrowsePath({ cityName }) });
    }

    const areaKey = `${cityName}|${listing.area}`;
    if (!areaPaths.has(areaKey)) {
      areaPaths.set(areaKey, { cityName, path: buildBrowsePath({ cityName, areaName: listing.area }) });
    }

    const groupKey = `${cityName}|${group}`;
    if (!groupPaths.has(groupKey)) {
      groupPaths.set(groupKey, { cityName, path: buildBrowsePath({ cityName, transactionGroup: group }) });
    }

    const categoryKey = `${groupKey}|${listing.category}`;
    if (!categoryPaths.has(categoryKey)) {
      categoryPaths.set(categoryKey, {
        cityName,
        path: buildBrowsePath({ cityName, transactionGroup: group, category: listing.category }),
      });
    }
  }

  const cityHubs = [...cityPaths.values()];
  const drillDowns = [...areaPaths.values(), ...groupPaths.values(), ...categoryPaths.values()];
  const isTop = (entry: BrowsePath) => topCityNames.has(entry.cityName);
  const toEntry = (entry: BrowsePath, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${entry.path}`,
    lastModified: new Date(),
    priority,
  });
  const browseEntries: MetadataRoute.Sitemap = [
    ...cityHubs.filter(isTop).map((entry) => toEntry(entry, 0.9)),
    ...drillDowns.filter(isTop).map((entry) => toEntry(entry, 0.8)),
    ...cityHubs.filter((entry) => !isTop(entry)).map((entry) => toEntry(entry, 0.6)),
    ...drillDowns.filter((entry) => !isTop(entry)).map((entry) => toEntry(entry, 0.5)),
  ];

  // Static informational pages. Previously absent, which left the legal/company pages
  // discoverable only by following footer links — the entity-disclosure pages in particular need
  // to be trivially reachable by a verification reviewer (see
  // docs/plans/finfolia-entity-disclosure.md). `robots.ts` already allows all of these.
  const staticEntries: MetadataRoute.Sitemap = [
    "/about",
    "/contact",
    "/help",
    "/terms",
    "/privacy",
    "/premium",
    "/tools",
    "/tools/emi-calculator",
    "/tools/down-payment-calculator",
    "/tools/home-loan-eligibility-calculator",
    "/tools/rent-vs-buy-calculator",
    "/tools/rent-affordability-calculator",
    "/tools/area-unit-converter",
    "/cities",
  ].map((path) => ({ url: `${SITE_URL}${path}`, lastModified: new Date() }));

  return [
    { url: SITE_URL, lastModified: new Date(), priority: 1 },
    ...staticEntries,
    ...browseEntries,
    ...listingEntries,
  ];
}
