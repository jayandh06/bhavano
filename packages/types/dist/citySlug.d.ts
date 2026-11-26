/** The state code in each US city's URL (`/austin-tx`), keyed by the city's stored name. US city names collide across states (Portland, OR and ME), so the US
 * plan puts the state in the slug (docs/plans/us-market-expansion.md, "URL structure"). India's slugs stay name-only. A city added to
 * apps/bff/prisma/data/usCities.json needs its entry here (a test keeps the two equal). */
export declare const US_CITY_STATE_CODES: Readonly<Record<string, string>>;
/** The URL segment for a city. Every link to a city, and every lookup of a city from a URL, must go through this (not `slugify`), or US links stop resolving.
 * The market is the build's or server's (`NEXT_PUBLIC_MARKET || MARKET`); anything but "us" is name-only, so India is unchanged. */
export declare function citySlug(name: string, marketId?: string | undefined): string;
