import type { Area, ListingCategory } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { AREAS_NONE } from "./areaSelection";
import { hasAssetFilter, intentOffersAssets } from "./assetFilters";
import { buildFilterUrl } from "./filterUrl";
import { buildBrowsePath } from "./listingPath";
import { parseAmount } from "./priceInput";
import { MAX_BEDROOMS, segmentsForHomeCategory, type ParsedSegments, type TransactionGroup } from "./seoRoute";
import type { HomeTabValue } from "./homeCategories";

/** Everything the filter section can change before Apply. A missing key means "not touched": the URL's own value stands. Nothing here reaches the URL until
 * `buildAppliedUrl` runs on Apply, which writes every pending change in one navigation (so one search, and the area, BHK, type and query filters can never
 * disagree about the path). */
export interface FilterDraft {
  /** Area ids ticked. Never empty when applied. */
  areas?: string[];
  /** Bedroom buckets ticked. Never empty when applied. */
  bhk?: number[];
  /** `{ asset: undefined }` is "All types". */
  asset?: { asset: ListingCategory | undefined };
  /** The two price boxes as typed ("20k", "2L"). Empty string = no bound. */
  price?: { min: string; max: string };
  /** Plain query-param filters (amenities as a comma list, furnished, sharingType, condition, serviceType, postedBy). A key present with `undefined` clears it. */
  query?: Record<string, string | undefined>;
}

export interface FilterBase {
  /** `path` on the browse pages; `query` on the homepage, which has no browse path and keeps every filter in the query string. */
  urlMode: "path" | "query";
  cityName?: string;
  /** Every area of the city (empty when no city is chosen). */
  areas: Area[];
  /** The browse page's parsed path (carries the single area, single BHK facet and category). Absent on the homepage. */
  segments?: ParsedSegments;
  /** The path's single area by name, kept when its slug is not in `areas`. */
  pathAreaName?: string;
  intent: HomeTabValue;
  /** The asset type now chosen: the path's category on a browse page, `?propertyType` / `?category` on the homepage. */
  category?: ListingCategory;
  /** The current query string without the leading `?`. */
  search: string;
}

export const BEDROOM_COUNTS = Array.from({ length: MAX_BEDROOMS }, (_, i) => i + 1);

/** Area ids selected right now: the path's single area, else `?areas=`, else every area. An empty array is the legacy `?areas=none` state. */
export function currentAreaIds(base: FilterBase): string[] {
  const params = new URLSearchParams(base.search);
  const slug = base.segments?.areaSlug;
  const pathAreaId = slug ? base.areas.find((a) => slugify(a.name) === slug)?.id : undefined;
  if (pathAreaId) return [pathAreaId];
  const raw = params.get("areas");
  if (raw === AREAS_NONE) return [];
  if (raw) return raw.split(",").filter(Boolean);
  return base.areas.map((a) => a.id);
}

/** Bedroom buckets selected right now: `?bedrooms=`, else the path's single-BHK facet, else all of them. */
export function currentBhk(base: FilterBase): number[] {
  const raw = new URLSearchParams(base.search).get("bedrooms");
  if (raw) return raw.split(",").map(Number).filter(Boolean);
  const facet = base.segments?.facetValue;
  if (typeof facet === "number") return [facet];
  return BEDROOM_COUNTS;
}

/** Why the draft cannot be applied yet, or null. At least one area and one BHK bucket must stay picked, and a typed price must make sense. */
export function draftIssue(draft: FilterDraft): string | null {
  if (draft.areas && draft.areas.length === 0) return "Pick at least one area";
  if (draft.bhk && draft.bhk.length === 0) return "Pick at least one BHK";
  if (draft.price) {
    const min = draft.price.min.trim();
    const max = draft.price.max.trim();
    const parsedMin = min ? parseAmount(min) : undefined;
    const parsedMax = max ? parseAmount(max) : undefined;
    if ((min && parsedMin === undefined) || (max && parsedMax === undefined)) return "Enter a price like 20000, 20k or 2L";
    if (parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax) return "Min price must be less than max";
  }
  return null;
}

function groupFor(base: FilterBase): TransactionGroup | undefined {
  // The tab says which transaction the visitor is in; a bare category path (/bengaluru/furniture) has none of its own.
  return segmentsForHomeCategory(base.intent).transactionGroup ?? base.segments?.transactionGroup;
}

/** The URL that applies `draft` on top of what is showing now. With an empty draft this is the current page in its canonical form. */
export function buildAppliedUrl(base: FilterBase, draft: FilterDraft): string {
  const params = new URLSearchParams(base.search);
  // A narrowing change returns to the first page, and the asset lives in the path (see buildFilterUrl).
  params.delete("page");
  params.delete("propertyType");
  params.delete("areas");
  params.delete("bedrooms");

  if (draft.price) {
    const min = draft.price.min.trim() ? parseAmount(draft.price.min) : undefined;
    const max = draft.price.max.trim() ? parseAmount(draft.price.max) : undefined;
    if (min !== undefined) params.set("minPrice", String(min));
    else params.delete("minPrice");
    if (max !== undefined) params.set("maxPrice", String(max));
    else params.delete("maxPrice");
  }
  for (const [key, value] of Object.entries(draft.query ?? {})) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }

  const assetChanged = !!draft.asset && draft.asset.asset !== base.category;
  const category = draft.asset ? draft.asset.asset : base.category;
  const areaIds = draft.areas ?? currentAreaIds(base);
  const allAreas = areaIds.length === base.areas.length && base.areas.length > 0;
  // BHK only means something where the asset has bedrooms; changing the asset drops a bucket choice it cannot hold.
  const bhkAllowed = hasAssetFilter(category, "bedrooms");
  const bhkDraft = draft.bhk ?? (assetChanged ? undefined : currentBhk(base));
  const bhk = bhkAllowed ? bhkDraft : undefined;
  const allBhk = !bhk || bhk.length === BEDROOM_COUNTS.length;

  const homeQuery = base.urlMode === "query" && !assetChanged;
  if (homeQuery) {
    if (areaIds.length === 0) params.set("areas", AREAS_NONE);
    else if (!allAreas) params.set("areas", areaIds.join(","));
    if (bhk && !allBhk) params.set("bedrooms", bhk.join(","));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  // Path mode (a browse page, or the homepage after the asset changed): a single area and a single BHK bucket become clean path segments, several go to the query.
  let areaName: string | undefined;
  if (areaIds.length === 0) {
    params.set("areas", AREAS_NONE);
  } else if (!allAreas) {
    if (areaIds.length === 1) {
      areaName = base.areas.find((a) => a.id === areaIds[0])?.name;
      if (!areaName) params.set("areas", areaIds.join(","));
    } else {
      params.set("areas", areaIds.join(","));
    }
  }
  // Nothing about the area changed and the path's own area is not in the list: keep it.
  if (!draft.areas && base.segments?.areaSlug && !areaName && !params.get("areas")) areaName = base.pathAreaName;

  let facetValue: number | undefined;
  if (bhk && !allBhk) {
    if (bhk.length === 1 && category) facetValue = bhk[0];
    else params.set("bedrooms", bhk.join(","));
  }

  const path = buildBrowsePath({ cityName: base.cityName, areaName, transactionGroup: groupFor(base), category, facetValue });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** The URL with every filter cleared: same city, tab and search text, no area, asset, BHK, price or other narrowing. */
export function buildResetUrl(base: FilterBase): string {
  const params = new URLSearchParams(base.search);
  for (const key of ["areas", "bedrooms", "minPrice", "maxPrice", "furnished", "sharingType", "condition", "serviceType", "amenities", "postedBy", "page", "propertyType"]) {
    params.delete(key);
  }
  if (base.urlMode === "query") {
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }
  const intentSegments = segmentsForHomeCategory(base.intent);
  return buildFilterUrl({
    cityName: base.cityName,
    group: intentSegments.transactionGroup,
    asset: intentOffersAssets(base.intent) ? undefined : intentSegments.category,
    searchParams: params,
  });
}
