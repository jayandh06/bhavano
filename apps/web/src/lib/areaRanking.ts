import type { Area } from "@bhavano/types";
import { MIN_INDEXABLE_AREA_LISTINGS } from "@/lib/seoIndexing";

/** The areas to link to from a city's pages (footer, "Explore nearby"), best first.
 *
 * These links used to be the city's areas in alphabetical order, capped at a few dozen, which on a
 * big city left out the areas with the most listings (names starting "1st Block", "2nd Stage" came
 * first). Now: areas with enough listings to be indexable, most listings first; below that, areas
 * that have any listing; and only if the city has none at all, the alphabetical list as before, so
 * a city with no data still gets links. `counts` is `{ areaId: activeListings }`. */
export function rankAreasForLinks(areas: Area[], counts: Record<string, number>): Area[] {
  const byListings = (a: Area, b: Area) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.name.localeCompare(b.name);
  const withListings = areas.filter((a) => (counts[a.id] ?? 0) > 0).sort(byListings);
  if (withListings.length === 0) return areas;
  const indexable = withListings.filter((a) => (counts[a.id] ?? 0) >= MIN_INDEXABLE_AREA_LISTINGS);
  return indexable.length >= 4 ? indexable : withListings;
}
