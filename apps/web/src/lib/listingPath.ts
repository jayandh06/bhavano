import { slugify } from "@bhavano/types/slugify";
import type { ListingCardDto, ListingCategory } from "@bhavano/types";
import { buildFacetSlug, transactionGroupFor, type TransactionGroup } from "./seoRoute";

/** Canonical SEO path for a listing: /{city}/{transactionGroup}/{category}/{locality}/{slug}-{id}.
 * Built entirely from card/detail DTO fields already in hand — no extra fetch needed. Facet
 * (bedroom count/sharing type/condition/service type) is a browse-level filter, not encoded in
 * an individual listing's own canonical URL — see `buildBrowsePath` for that. */
export function buildListingPath(item: Pick<ListingCardDto, "id" | "slug" | "category" | "transactionType" | "cityName" | "area">): string {
  const group = transactionGroupFor(item.transactionType);
  return `/${slugify(item.cityName)}/${group}/${item.category}/${slugify(item.area)}/${item.slug}-${item.id}`;
}

/** Browse-landing path: /{city}[/{transactionGroup}[/{category}[/{facet}]]][/{locality}] —
 * every part after city is optional, built up to however deep the caller has resolved. */
export function buildBrowsePath(params: {
  cityName: string;
  transactionGroup?: TransactionGroup;
  category?: ListingCategory;
  facetValue?: string | number;
  areaName?: string;
}): string {
  const parts = [slugify(params.cityName)];
  if (params.transactionGroup) parts.push(params.transactionGroup);
  if (params.category) parts.push(params.category);
  if (params.category && params.facetValue !== undefined) parts.push(buildFacetSlug(params.category, params.facetValue));
  if (params.areaName) parts.push(slugify(params.areaName));
  return `/${parts.join("/")}`;
}
