import type { PopularSearchDto } from "@bhavano/types";
import { fetchPopularSearches } from "@/lib/bff";

// Only used if the popular-searches query comes back empty for this city (e.g. a freshly-seeded
// city with no view counts yet) — real data always wins once there's inventory to rank. Built
// from the *current* city rather than a hardcoded one, since this is scoped per-city — showing
// another city's searches here would be a confusing fallback.
function fallbackSearchesFor(cityName: string): PopularSearchDto[] {
  return [
    { cityName, category: "house", transactionType: "rent", count: 0 },
    { cityName, category: "apartment", transactionType: "sell", count: 0 },
    { cityName, category: "coworking", transactionType: "rent", count: 0 },
    { cityName, category: "pg", transactionType: "rent", count: 0 },
  ];
}

/** Shared by every page that renders `<Header>`'s search bar with a "Popular searches" section —
 * fetches this city's top (category, transactionType) combinations by view count, falling back to
 * a generic per-city set when there's no data yet. */
export async function resolvePopularSearches(cityName: string, cityId?: string): Promise<PopularSearchDto[]> {
  const results = await fetchPopularSearches(cityId).catch(() => []);
  return results.length > 0 ? results : fallbackSearchesFor(cityName);
}
