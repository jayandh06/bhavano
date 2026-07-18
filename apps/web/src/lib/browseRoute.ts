import type { City, Area } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { fetchAreas, fetchCities } from "@/lib/bff";

// The pure type guards/label maps live in seoRoute.ts (which must stay free of any server-only
// dependency, since it's reachable from client components) — re-exported here so existing
// callers of this (genuinely server-only, DB-touching) module don't need two import sources.
export {
  CATEGORY_LABELS,
  isListingCategory,
  isTransactionType,
  LISTING_CATEGORIES,
  TRANSACTION_LABELS,
  TRANSACTION_TYPES,
} from "@/lib/seoRoute";

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
