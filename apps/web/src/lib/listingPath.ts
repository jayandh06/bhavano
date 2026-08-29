import { slugify } from "@bhavano/types/slugify";
import type { ListingCardDto, ListingCategory } from "@bhavano/types";
import { buildFacetSlug, categoryGroupsFor, transactionGroupFor, type TransactionGroup } from "./seoRoute";

/** Canonical SEO path for a listing: /{city}/{locality}/{transactionGroup}/{category}/{slug}-{id}.
 * Built entirely from card/detail DTO fields already in hand — no extra fetch needed. Facet
 * (bedroom count/sharing type/condition/service type) is a browse-level filter, not encoded in
 * an individual listing's own canonical URL — see `buildBrowsePath` for that. */
export function buildListingPath(item: Pick<ListingCardDto, "id" | "slug" | "category" | "transactionType" | "cityName" | "area">): string {
  const group = transactionGroupFor(item.transactionType);
  return `/${slugify(item.cityName)}/${slugify(item.area)}/${group}/${item.category}/${item.slug}-${item.id}`;
}

/** Browse-landing path: /{city}[/{locality}][/{transactionGroup}[/{category}[/{facet}]]] —
 * area sits right after the city (so /{city}/{locality} is a real landing page on its own),
 * everything else is optional and built up to however deep the caller has resolved. */
export function buildBrowsePath(params: {
  /** Omitted for national browsing — `/buy`, `/rent-lease/pg`, `/furniture`. The category
   * vocabulary is reserved at the city position precisely so those cannot be mistaken for a
   * city slug (see `isReservedSegment`). With no city there is no area either: a locality is
   * only meaningful inside one. */
  cityName?: string;
  transactionGroup?: TransactionGroup;
  category?: ListingCategory;
  facetValue?: string | number;
  areaName?: string;
}): string {
  const parts = params.cityName ? [slugify(params.cityName)] : [];
  if (params.cityName && params.areaName) parts.push(slugify(params.areaName));
  // Drop the group when the category only has one — PG is rent-only, interiors and plots are
  // sell-only, so "/rent-lease/pg" spends a segment saying something "/pg" already implies. The
  // group stays wherever it genuinely narrows: houses, apartments, villas, commercial, furniture.
  //
  // This is presentation, not meaning: callers still pass the group they mean, and
  // `parseSegments` still accepts the long form, so already-indexed URLs keep resolving and the
  // catch-all's canonical redirect 301s them to the short one.
  const groupIsRedundant = params.category !== undefined && categoryGroupsFor(params.category).length === 1;
  if (params.transactionGroup && !groupIsRedundant) parts.push(params.transactionGroup);
  if (params.category) parts.push(params.category);
  if (params.category && params.facetValue !== undefined) parts.push(buildFacetSlug(params.category, params.facetValue));
  return `/${parts.join("/")}`;
}
