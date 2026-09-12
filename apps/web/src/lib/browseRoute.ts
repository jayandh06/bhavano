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
 * the slug. Fetches the full city list (`all: true`, no `q`) rather than narrowing with a
 * substring search first — a name that itself contains a hyphen (e.g. "Pimpri-Chinchwad") can't
 * be reliably turned back into a search string: `citySlug.replace(/-/g, " ")` used to assume
 * every hyphen came from a collapsed space, so "pimpri-chinchwad" became the search term
 * "pimpri chinchwad", which doesn't substring-match the real name "Pimpri-Chinchwad" and 404'd
 * every listing/browse page under that city. The city list is small enough (same call the
 * listing detail page and popular-cities lists already make) that fetching it whole and doing
 * the exact match locally is both simpler and actually correct. */
export async function resolveCity(citySlug: string): Promise<City | null> {
  const candidates = await fetchCities(undefined, true);
  return candidates.find((c) => slugify(c.name) === citySlug) ?? null;
}

/** Same reasoning as resolveCity above — some real area names contain a hyphen ("Phase - III",
 * "Porur Garden-I"), which a naive slug-to-search reversal can't round-trip. `all: true` is
 * already the flag `searchAreas` uses for "every area in this city" (the multi-select area
 * filter), scoped to one city so it stays a bounded query. */
export async function resolveArea(cityId: string, localitySlug: string): Promise<Area | null> {
  const candidates = await fetchAreas(cityId, undefined, true);
  return candidates.find((a) => slugify(a.name) === localitySlug) ?? null;
}
