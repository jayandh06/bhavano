import type { Area, City, ListingCategory } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchListings, type ListingsQuery } from "@/lib/bff";
import { homeCategoryForSegments, type ParsedSegments } from "@/lib/seoRoute";
import { Header } from "./Header";
import { ListingGrid } from "./ListingGrid";
import { AreaFilter } from "./AreaFilter";
import { BrowseFilterBar } from "./BrowseFilterBar";
import { Footer } from "./Footer";

const PAGE_SIZE = 12;

/** Shared body for the SEO browse-landing pages — a filtered grid driven by an already-resolved
 * query (see apps/web/src/lib/seoRoute.ts for how a URL's segments become this), distinct from
 * the homepage's own tab-grouped browsing model. */
export async function BrowseListingsView({
  query,
  cityName,
  heading,
  page,
  basePath,
  filterCategory,
  filterIsSale,
  popularCities,
  userName,
  currentSegments,
  areaName,
  cityAreas,
}: {
  query: Omit<ListingsQuery, "limit" | "cursor">;
  cityName: string;
  heading: string;
  page: number;
  basePath: string;
  /** Which category's price/furnished quick-picks to show — omitted (city/group-root pages)
   * means no filter bar at all, since there's no single category to size price brackets for. */
  filterCategory?: ListingCategory;
  filterIsSale?: boolean;
  popularCities: City[];
  userName?: string | null;
  currentSegments: ParsedSegments;
  areaName?: string;
  /** Every area in this city, for the multi-select `AreaFilter` — distinct from `areaName`
   * (just a placeholder hint for the search bar). */
  cityAreas: Area[];
}) {
  const session = await auth();
  const limit = page * PAGE_SIZE;
  const listingsPage = await fetchListings({ ...query, limit }, session?.accessToken);
  const hasMore = listingsPage.items.length < listingsPage.total;

  const loadMoreParams = new URLSearchParams();
  if (query.minPrice !== undefined) loadMoreParams.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) loadMoreParams.set("maxPrice", String(query.maxPrice));
  if (query.furnished) loadMoreParams.set("furnished", query.furnished);
  if (query.areaIds && query.areaIds.length > 0) loadMoreParams.set("areas", query.areaIds.join(","));
  loadMoreParams.set("page", String(page + 1));
  const loadMoreHref = hasMore ? `${basePath}?${loadMoreParams.toString()}` : null;

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery=""
        activeCategory={homeCategoryForSegments(currentSegments)}
        userName={userName}
        currentSegments={currentSegments}
        areaName={areaName}
      />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-20">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="font-lora text-[26px] font-semibold m-0 text-text">{heading}</h1>
          <span className="text-[13px] text-muted">{listingsPage.total} listings</span>
        </div>
        <div className="flex gap-2.5 mb-5 flex-wrap">
          <AreaFilter cityName={cityName} areas={cityAreas} currentSegments={currentSegments} />
          <BrowseFilterBar
            category={filterCategory}
            isSale={filterIsSale ?? true}
            activeMinPrice={query.minPrice}
            activeMaxPrice={query.maxPrice}
            activeFurnished={query.furnished}
          />
        </div>
        <ListingGrid items={listingsPage.items} cityName={cityName} loadMoreHref={loadMoreHref} />
      </main>
      <Footer />
    </div>
  );
}
