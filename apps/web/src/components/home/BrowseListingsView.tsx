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
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery=""
        activeCategory={homeCategoryForSegments(currentSegments)}
        userName={userName}
        currentSegments={currentSegments}
        areaName={areaName}
      />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: 0, color: "var(--text)" }}>
            {heading}
          </h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{listingsPage.total} listings</span>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
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
