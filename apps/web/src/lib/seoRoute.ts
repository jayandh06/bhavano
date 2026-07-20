import type { HomeCategoryFilter, ListingCategory, PropertyTypeFilter, TransactionType } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG } from "@bhavano/types/categoryFields";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { MAX_BEDROOMS, bedroomLabel } from "@bhavano/types/bedrooms";

export { MAX_BEDROOMS, bedroomLabel };

// Deliberately zero dependency on `@/lib/bff` (which starts with `import "server-only"`) or
// anything that imports it — this file is reachable from client components too (ListingCard.tsx
// → listingPath.ts → here), and pulling in a server-only module would break the client bundle.
// `@/lib/browseRoute` re-exports the type guards/labels below for its own (server-only)
// resolveCity/resolveArea callers, rather than this file depending on that one.

export const TRANSACTION_TYPES: TransactionType[] = ["buy", "sell", "rent", "lease"];
export const LISTING_CATEGORIES: ListingCategory[] = [
  "house",
  "apartment",
  "pg",
  "storage",
  "coworking",
  "furniture",
  "interiors",
  "plot",
  "commercial",
];

export function isTransactionType(value: string): value is TransactionType {
  return (TRANSACTION_TYPES as string[]).includes(value);
}

export function isListingCategory(value: string): value is ListingCategory {
  return (LISTING_CATEGORIES as string[]).includes(value);
}

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  house: "Houses",
  apartment: "Apartments",
  pg: "PG Accommodation",
  storage: "Storage Spaces",
  coworking: "Coworking Desks",
  furniture: "Furniture",
  interiors: "Interiors",
  plot: "Plots",
  commercial: "Commercial Spaces",
};

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  buy: "for Sale",
  sell: "for Sale",
  rent: "for Rent",
  lease: "for Lease",
};

/** The subset of `ListListingsDto`'s fields the URL grammar (mega-menu links and the SEO
 * catch-all route) ever needs to populate — a local type rather than importing `ListingsQuery`
 * from `@/lib/bff` so this file stays free of that server-only module. */
export interface SegmentQuery {
  homeCategory?: HomeCategoryFilter;
  propertyType?: PropertyTypeFilter;
  category?: ListingCategory;
  transactionType?: TransactionType;
  bedrooms?: number[];
  sharingType?: string;
  condition?: string;
  serviceType?: string;
}

/** The URL grammar's top-level segment — groups the 4 real `TransactionType` values the same
 * way the homepage's tabs already do (buy+sell, rent+lease), so `/city/buy/...` reads naturally
 * instead of exposing the raw enum. */
export type TransactionGroup = "buy" | "rent-lease";

export function transactionGroupFor(t: TransactionType): TransactionGroup {
  return t === "buy" || t === "sell" ? "buy" : "rent-lease";
}

export function isTransactionGroup(value: string): value is TransactionGroup {
  return value === "buy" || value === "rent-lease";
}

/** Which groups a category is reachable under, derived from POSTABLE_TRANSACTION_TYPES —
 * one source of truth, not a second hardcoded map. */
export function categoryGroupsFor(category: ListingCategory): TransactionGroup[] {
  const types = POSTABLE_TRANSACTION_TYPES[category];
  const groups: TransactionGroup[] = [];
  if (types.some((t) => t === "buy" || t === "sell")) groups.push("buy");
  if (types.some((t) => t === "rent" || t === "lease")) groups.push("rent-lease");
  return groups;
}

/** Generic Next.js searchParams parsing helpers shared by the homepage and the SEO catch-all
 * route, which both parse the same set of query-string dimensions (minPrice/maxPrice/furnished/
 * bedrooms/etc.) from two different URL shapes. */
export function parsePositiveInt(value: string | string[] | undefined): number | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Parses a comma-separated list of positive integers (e.g. `?bedrooms=1,3,5`) — used by the
 * multi-select BHK filter, which (unlike the single-value `parsePositiveInt` fields) can carry
 * more than one bucket at once. Returns `undefined` if the param is absent or every entry is
 * invalid, so callers can tell "not filtering" apart from "filtered to nothing valid." */
export function parseIntList(value: string | string[] | undefined): number[] | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === undefined) return undefined;
  const nums = v
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0);
  return nums.length > 0 ? nums : undefined;
}

/** Shared by the homepage and the `[city]/[[...rest]]` route's `generateMetadata`/page body, so
 * all three can never disagree on which page a request is for (see
 * docs/plans/seo-distinct-window-pagination.md). Always ≥ 1 — invalid/missing input is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function parseEnum<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return allowed.includes(v as T) ? (v as T) : undefined;
}

export const FURNISHING_VALUES = ["unfurnished", "semi", "furnished"] as const;
export const PROPERTY_TYPE_VALUES: PropertyTypeFilter[] = ["house", "apartment", "storage", "coworking"];
export const SHARING_TYPE_VALUES = CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")!.options!.map((o) => o.value);
export const CONDITION_VALUES = CATEGORY_FIELD_CONFIG.furniture.find((f) => f.key === "condition")!.options!.map((o) => o.value);
export const SERVICE_TYPE_VALUES = CATEGORY_FIELD_CONFIG.interiors.find((f) => f.key === "serviceType")!.options!.map((o) => o.value);

/** Same 4 sort dimensions for every category — all plain top-level `Listing` columns
 * (createdAt/price/viewCount). See ListingsService.list()'s `ORDER_BY` lookup for how each maps
 * to a Prisma `orderBy`. */
export const SORT_VALUES = ["newest", "price_asc", "price_desc", "popular"] as const;

export type FacetKind = "bedrooms" | "sharingType" | "condition" | "serviceType" | "none";

export function facetKindForCategory(category: ListingCategory): FacetKind {
  if (category === "house" || category === "apartment") return "bedrooms";
  if (category === "pg") return "sharingType";
  if (category === "furniture") return "condition";
  if (category === "interiors") return "serviceType";
  return "none";
}

const BEDROOM_SLUG_RE = /^([1-5])bhk$/;

/** Compact INR formatting for quick-pick price brackets and the search bar's live interpretation
 * preview — the two places a raw rupee amount needs to read like "₹85L"/"₹1.2Cr" instead of a
 * long number. */
export function formatINR(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${n}`;
}

function facetOptionValues(category: ListingCategory, key: string): string[] {
  return CATEGORY_FIELD_CONFIG[category].find((f) => f.key === key)?.options?.map((o) => o.value) ?? [];
}

/** Parses a facet URL segment for the given category — returns `undefined` if it doesn't match
 * (the caller then knows to try this segment as a locality/listing instead, since a facet
 * segment is optional in the grammar). */
export function parseFacetSlug(category: ListingCategory, slug: string): string | number | undefined {
  const kind = facetKindForCategory(category);
  if (kind === "bedrooms") {
    const match = BEDROOM_SLUG_RE.exec(slug);
    return match ? Number(match[1]) : undefined;
  }
  if (kind === "none") return undefined;
  const key = kind === "sharingType" ? "sharingType" : kind === "condition" ? "condition" : "serviceType";
  return facetOptionValues(category, key).includes(slug) ? slug : undefined;
}

export function buildFacetSlug(category: ListingCategory, value: string | number): string {
  const kind = facetKindForCategory(category);
  return kind === "bedrooms" ? `${value}bhk` : String(value);
}

/** cuids contain no hyphens, so a real listing slug-id always ends in `-` + a long alnum
 * blob — no real locality name looks like that, so this reliably disambiguates a terminal
 * "is this a listing or a locality" segment without needing a DB round-trip. */
export function looksLikeListingSlugId(segment: string): boolean {
  return /-[a-z0-9]{20,}$/i.test(segment);
}

/** cuids contain no hyphens, so the last "-"-segment of a slug-id is always the id. */
export function extractListingId(slugId: string): string {
  const lastDash = slugId.lastIndexOf("-");
  return lastDash === -1 ? slugId : slugId.slice(lastDash + 1);
}

export interface ParsedSegments {
  transactionGroup?: TransactionGroup;
  category?: ListingCategory;
  facetValue?: string | number;
  areaSlug?: string;
  listingSlugId?: string;
}

/** Walks the `rest` array strictly left-to-right per the grammar
 * (`/{city}/{locality}/{transactionGroup}/{category}/{facet}/{slug}-{id}`) — area sits right
 * after the city (so `/{city}/{area}` is a real, indexable landing page on its own), everything
 * after that is optional but can't be skipped out of order. Returns `null` for any invalid
 * combination (unknown group/category, a category not valid under its group, malformed tail).
 *
 * Also still parses the *old* area-last shape
 * (`/{city}/{transactionGroup}/{category}/{facet}/{locality}/{slug}-{id}`) purely so
 * already-indexed/bookmarked listing URLs keep resolving (by id) instead of 404ing — the page
 * then 301s to the new canonical via `buildListingPath`. `buildBrowsePath`/`buildListingPath`
 * never produce that shape anymore. */
export function parseSegments(rest: string[]): ParsedSegments | null {
  const result: ParsedSegments = {};
  let i = 0;
  if (i >= rest.length) return result;

  // New-shape area, right after the city — anything that isn't a transactionGroup keyword (and
  // isn't itself a listing slug-id, which never legitimately appears this early). Whether it's a
  // *real* locality is verified against the DB by the caller (resolveArea), same as before.
  let areaConsumedAtFront = false;
  if (!isTransactionGroup(rest[i]) && !looksLikeListingSlugId(rest[i])) {
    result.areaSlug = rest[i];
    areaConsumedAtFront = true;
    i++;
    if (i >= rest.length) return result;
  }

  const groupCandidate = rest[i];
  if (!isTransactionGroup(groupCandidate)) return null;
  const transactionGroup = groupCandidate;
  result.transactionGroup = transactionGroup;
  i++;
  if (i >= rest.length) return result;

  const categoryCandidate = rest[i];
  if (!isListingCategory(categoryCandidate) || !categoryGroupsFor(categoryCandidate).includes(transactionGroup)) return null;
  const category = categoryCandidate;
  result.category = category;
  i++;
  if (i >= rest.length) return result;

  if (facetKindForCategory(category) !== "none") {
    const facetValue = parseFacetSlug(category, rest[i]);
    if (facetValue !== undefined) {
      result.facetValue = facetValue;
      i++;
    }
  }
  if (i >= rest.length) return result;

  const remaining = rest.slice(i);

  // New shape: the area (if any) was already consumed up front, so only a terminal listing
  // slug-id can legitimately remain here — a second trailing segment would be ambiguous.
  if (areaConsumedAtFront) {
    if (remaining.length === 1 && looksLikeListingSlugId(remaining[0])) {
      result.listingSlugId = remaining[0];
      return result;
    }
    return null;
  }

  // Old shape fallback (area at the end) — see the doc comment above.
  if (remaining.length > 2) return null;

  if (remaining.length === 1) {
    if (looksLikeListingSlugId(remaining[0])) result.listingSlugId = remaining[0];
    else result.areaSlug = remaining[0];
    return result;
  }

  const [localitySeg, listingSeg] = remaining;
  if (!looksLikeListingSlugId(listingSeg)) return null;
  result.areaSlug = localitySeg;
  result.listingSlugId = listingSeg;
  return result;
}

/** Maps a parsed, resolved browse target onto the `fetchListings` query shape the mega-menu
 * already uses for the identical combination — `cityId`/`areaId` are added by the caller once
 * resolved, since this function only knows about the URL grammar, not the DB. */
export function buildQueryForSegments(parsed: ParsedSegments): SegmentQuery {
  const { transactionGroup, category, facetValue } = parsed;
  if (!category) {
    return transactionGroup ? { homeCategory: transactionGroup === "buy" ? "buy" : "rentLease" } : {};
  }
  if (category === "furniture") {
    return {
      category: "furniture",
      transactionType: transactionGroup === "buy" ? "sell" : "rent",
      condition: typeof facetValue === "string" ? facetValue : undefined,
    };
  }
  if (category === "pg") return { homeCategory: "pg", sharingType: typeof facetValue === "string" ? facetValue : undefined };
  if (category === "interiors") return { homeCategory: "interiors", serviceType: typeof facetValue === "string" ? facetValue : undefined };
  if (category === "storage" || category === "coworking") {
    return { homeCategory: "rentLease", propertyType: category };
  }
  // house/apartment
  return {
    homeCategory: transactionGroup === "buy" ? "buy" : "rentLease",
    propertyType: category,
    bedrooms: typeof facetValue === "number" ? [facetValue] : undefined,
  };
}

/** Maps a parsed URL onto the homepage's tab-grouped `HomeCategoryFilter` — used to highlight the
 * right tab (and thus mega-menu) in `<Header>` when it's rendered on a path-driven SEO page rather
 * than the homepage's own query-string-driven one. Falls back to "buy" for the bare city/group
 * root, matching the homepage's own default tab. */
export function homeCategoryForSegments(parsed: ParsedSegments): HomeCategoryFilter {
  const { category, transactionGroup } = parsed;
  if (category === "furniture") return "furniture";
  if (category === "pg") return "pg";
  if (category === "interiors") return "interiors";
  return transactionGroup === "rent-lease" ? "rentLease" : "buy";
}

/** Human-readable H1 for whatever combination of filters is active — shared by the homepage
 * (query-string driven) and the SEO catch-all route (path-segment driven), both of which reduce
 * to the same underlying dimensions. `fallbackLabel` is used when nothing more specific is
 * resolved (e.g. the homepage's current tab name, or "All Listings" for the SEO city root). */
export function buildHeading(params: {
  fallbackLabel: string;
  cityName: string;
  areaName?: string;
  propertyType?: PropertyTypeFilter;
  bedrooms?: number;
  listingCategory?: ListingCategory;
  transactionType?: TransactionType;
  sharingType?: string;
  condition?: string;
  serviceType?: string;
}): string {
  const { fallbackLabel, cityName, areaName, propertyType, bedrooms, listingCategory, transactionType, sharingType, condition, serviceType } =
    params;
  const place = areaName ? `${areaName}, ${cityName}` : cityName;

  if (listingCategory) {
    const conditionLabel = condition
      ? CATEGORY_FIELD_CONFIG.furniture.find((f) => f.key === "condition")?.options?.find((o) => o.value === condition)?.label
      : undefined;
    const base = `${conditionLabel ? `${conditionLabel} ` : ""}${CATEGORY_LABELS[listingCategory]}`;
    const suffix = transactionType ? TRANSACTION_LABELS[transactionType] : "";
    return `${base} ${suffix} in ${place}`.replace(/\s+/g, " ").trim();
  }
  if (bedrooms !== undefined && propertyType) {
    return `${bedroomLabel(bedrooms)} BHK ${CATEGORY_LABELS[propertyType]} in ${place}`;
  }
  if (sharingType) {
    const label = CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")?.options?.find((o) => o.value === sharingType)?.label ?? sharingType;
    return `PG ${label} in ${place}`;
  }
  if (serviceType) {
    const label =
      CATEGORY_FIELD_CONFIG.interiors.find((f) => f.key === "serviceType")?.options?.find((o) => o.value === serviceType)?.label ?? serviceType;
    return `${label} Interiors in ${place}`;
  }
  if (propertyType) {
    return `${CATEGORY_LABELS[propertyType]} in ${place}`;
  }
  return `${fallbackLabel} in ${place}`;
}
