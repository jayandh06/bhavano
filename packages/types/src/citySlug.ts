import { slugify } from "./slugify";

declare const process: { env: Record<string, string | undefined> };

/** The state code in each US city's URL (`/austin-tx`), keyed by the city's stored name. US city names collide across states (Portland, OR and ME), so the US
 * plan puts the state in the slug (docs/plans/us-market-expansion.md, "URL structure"). India's slugs stay name-only. A city added to
 * apps/bff/prisma/data/usCities.json needs its entry here (a test keeps the two equal). */
export const US_CITY_STATE_CODES: Readonly<Record<string, string>> = {
  Atlanta: "ga",
  Austin: "tx",
  Boston: "ma",
  Charlotte: "nc",
  Chicago: "il",
  Dallas: "tx",
  Denver: "co",
  Houston: "tx",
  "Los Angeles": "ca",
  Miami: "fl",
  "New York": "ny",
  Phoenix: "az",
  "San Francisco": "ca",
  Seattle: "wa",
  Washington: "dc",
};

/** The URL segment for a city. Every link to a city, and every lookup of a city from a URL, must go through this (not `slugify`), or US links stop resolving.
 * The market is the build's or server's (`NEXT_PUBLIC_MARKET || MARKET`); anything but "us" is name-only, so India is unchanged. */
export function citySlug(name: string, marketId: string | undefined = process.env.NEXT_PUBLIC_MARKET || process.env.MARKET): string {
  const code = marketId === "us" ? US_CITY_STATE_CODES[name.trim()] : undefined;
  return slugify(code ? `${name} ${code}` : name);
}
