import type { ListingCategory, TransactionType } from "@bhavano/types";
import type { City, Area } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { fetchAreas, fetchCities } from "@/lib/bff";

export const TRANSACTION_TYPES: TransactionType[] = ["buy", "sell", "rent", "lease"];
export const LISTING_CATEGORIES: ListingCategory[] = ["house", "apartment", "pg", "storage", "coworking", "furniture"];

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
};

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  buy: "for Sale",
  sell: "for Sale",
  rent: "for Rent",
  lease: "for Lease",
};

/** Resolves a URL city slug back to the real City row by comparing `slugify(name)` against
 * the slug — `fetchCities` does a substring search, so we still need the exact-match filter. */
export async function resolveCity(citySlug: string): Promise<City | null> {
  const candidates = await fetchCities(citySlug.replace(/-/g, " "));
  return candidates.find((c) => slugify(c.name) === citySlug) ?? null;
}

export async function resolveArea(cityId: string, localitySlug: string): Promise<Area | null> {
  const candidates = await fetchAreas(cityId, localitySlug.replace(/-/g, " "));
  return candidates.find((a) => slugify(a.name) === localitySlug) ?? null;
}
