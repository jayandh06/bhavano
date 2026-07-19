import { slugify } from "@bhavano/types/slugify";
import type { ListingCardDto, ListingCategory } from "@bhavano/types";
import { buildFacetSlug, transactionGroupFor, type TransactionGroup } from "./seoRoute";

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
  cityName: string;
  transactionGroup?: TransactionGroup;
  category?: ListingCategory;
  facetValue?: string | number;
  areaName?: string;
}): string {
  const parts = [slugify(params.cityName)];
  if (params.areaName) parts.push(slugify(params.areaName));
  if (params.transactionGroup) parts.push(params.transactionGroup);
  if (params.category) parts.push(params.category);
  if (params.category && params.facetValue !== undefined) parts.push(buildFacetSlug(params.category, params.facetValue));
  return `/${parts.join("/")}`;
}
