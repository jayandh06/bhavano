import { slugify } from "@bhavano/types/slugify";
import type { ListingCardDto, ListingCategory, TransactionType } from "@bhavano/types";

/** Canonical SEO path for a listing: /{transaction}/{category}/{city}/{locality}/{slug}-{id}.
 * Built entirely from card/detail DTO fields already in hand — no extra fetch needed. */
export function buildListingPath(item: Pick<ListingCardDto, "id" | "slug" | "category" | "transactionType" | "cityName" | "area">): string {
  return `/${item.transactionType}/${item.category}/${slugify(item.cityName)}/${slugify(item.area)}/${item.slug}-${item.id}`;
}

/** Browse-landing path: /{transaction}/{category}/{city}[/{locality}]. */
export function buildBrowsePath(
  transactionType: TransactionType,
  category: ListingCategory,
  cityName: string,
  areaName?: string,
): string {
  const base = `/${transactionType}/${category}/${slugify(cityName)}`;
  return areaName ? `${base}/${slugify(areaName)}` : base;
}
