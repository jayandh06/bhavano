"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.US_CITY_STATE_CODES = void 0;
exports.citySlug = citySlug;
const slugify_1 = require("./slugify");
/** The state code in each US city's URL (`/austin-tx`), keyed by the city's stored name. US city names collide across states (Portland, OR and ME), so the US
 * plan puts the state in the slug (docs/plans/us-market-expansion.md, "URL structure"). India's slugs stay name-only. A city added to
 * apps/bff/prisma/data/usCities.json needs its entry here (a test keeps the two equal). */
exports.US_CITY_STATE_CODES = {
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
function citySlug(name, marketId = process.env.NEXT_PUBLIC_MARKET || process.env.MARKET) {
    const code = marketId === "us" ? exports.US_CITY_STATE_CODES[name.trim()] : undefined;
    return (0, slugify_1.slugify)(code ? `${name} ${code}` : name);
}
