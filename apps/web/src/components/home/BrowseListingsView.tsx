import { notFound } from "next/navigation";
import type { Area, City, ListingCardDto, ListingCategory } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchListings, type ListingsQuery } from "@/lib/bff";
import { homeCategoryForSegments, type ParsedSegments } from "@/lib/seoRoute";
import { buildListingPath } from "@/lib/listingPath";
import { Header } from "./Header";
import { ListingGrid } from "./ListingGrid";
import { AreaFilter } from "./AreaFilter";
import { BhkFilter } from "./BhkFilter";
import { BrowseFilterBar } from "./BrowseFilterBar";
import { SortDropdown } from "./SortDropdown";
import { Pagination } from "./Pagination";
import { Footer } from "./Footer";
import { BrowseSeoIntro } from "./BrowseSeoIntro";
import { JsonLd } from "@/components/JsonLd";
import { resolvePopularSearches } from "@/lib/popularSearches";

const PAGE_SIZE = 12;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

/** ItemList schema for the current page's result grid — `position` is the listing's rank across
 * the whole result set (not just this page), so paginated pages describe a coherent single list. */
function browseItemListJsonLd(items: ListingCardDto[], offset: number, total: number) {
  return {
    "@type": "ItemList",
    numberOfItems: total,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: offset + i + 1,
      url: `${SITE_URL}${buildListingPath(item)}`,
      name: item.title,
      ...(item.photos[0] ? { image: item.photos[0] } : {}),
    })),
  };
}

/** Wraps the result `ItemList` in a `CollectionPage` — schema.org's convention for a search-
 * results/browse page, distinct from the `ItemList` alone which just describes the list itself. */
function browseCollectionPageJsonLd(params: { heading: string; url: string; itemList: ReturnType<typeof browseItemListJsonLd> }) {
  return {
    "@type": "CollectionPage",
    name: params.heading,
    url: params.url,
    mainEntity: params.itemList,
  };
}

/** Distinct-window `?page=N` href for this browse page — page 1 always omits `page` entirely so
 * it matches the canonical (no-query) path exactly (see docs/plans/seo-distinct-window-pagination.md). */
function buildPageHref(basePath: string, query: Omit<ListingsQuery, "limit" | "cursor" | "offset">, page: number): string {
  const params = new URLSearchParams();
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.furnished) params.set("furnished", query.furnished);
  if (query.areaIds && query.areaIds.length > 0) params.set("areas", query.areaIds.join(","));
  if (query.bedrooms && query.bedrooms.length > 0) params.set("bedrooms", query.bedrooms.join(","));
  if (query.sort) params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

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
  pathAreaName,
  cityAreas,
  allCities,
}: {
  query: Omit<ListingsQuery, "limit" | "cursor" | "offset">;
  /** Undefined for national browsing (`/buy`, `/furniture`). Without a city there is no area
   * filter to offer and no city-scoped footer links, so both are dropped rather than shown
   * empty. */
  cityName?: string;
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
  /** Locality from the URL path (`/{city}/{area}/…`), when present — not the search-bar placeholder. */
  pathAreaName?: string;
  /** Every area in this city, for the multi-select `AreaFilter` — distinct from `areaName`
   * (just a placeholder hint for the search bar). */
  cityAreas: Area[];
  /** Every city, passed through to the footer's all-cities block — the caller already fetches
   * this for `popularCities`, so reuse it instead of Footer fetching it again. */
  allCities: City[];
}) {
  const session = await auth();
  const offset = (page - 1) * PAGE_SIZE;
  const [listingsPage, popularSearches] = await Promise.all([
    fetchListings({ ...query, offset, limit: PAGE_SIZE }, session?.accessToken),
    resolvePopularSearches(cityName ?? "India", query.cityId),
  ]);

  // Page 1 with zero results is a normal "nothing here yet" state — only pages *past* the last
  // real page are a crawl-trap/dead-end worth 404ing (see docs/plans/seo-distinct-window-pagination.md).
  const totalPages = Math.ceil(listingsPage.total / PAGE_SIZE);
  if (page > 1 && page > totalPages) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery=""
        activeCategory={homeCategoryForSegments(currentSegments)}
        userName={userName}
        currentSegments={currentSegments}
        areaName={areaName}
        popularSearches={popularSearches}
      />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-20">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="font-lora text-[26px] font-semibold m-0 text-text">{heading}</h1>
          <span className="text-[13px] text-muted">{listingsPage.total} listings</span>
        </div>
        {page === 1 && cityName && (
          <BrowseSeoIntro
            heading={heading}
            cityName={cityName}
            areaName={pathAreaName}
            segments={currentSegments}
            listingTotal={listingsPage.total}
            cityAreas={cityAreas}
          />
        )}
        <div className="flex gap-2.5 mb-5 flex-wrap justify-between items-start">
          <div className="flex gap-2.5 flex-wrap">
            {cityName && <AreaFilter cityName={cityName} areas={cityAreas} currentSegments={currentSegments} />}
            {cityName && (filterCategory === "house" || filterCategory === "apartment") && (
              <BhkFilter cityName={cityName} category={filterCategory} currentSegments={currentSegments} />
            )}
            <BrowseFilterBar
              category={filterCategory}
              isSale={filterIsSale ?? true}
              activeMinPrice={query.minPrice}
              activeMaxPrice={query.maxPrice}
              activeFurnished={query.furnished}
            />
          </div>
          <SortDropdown activeSort={query.sort} />
        </div>
        {listingsPage.items.length > 0 && (
          <JsonLd
            data={browseCollectionPageJsonLd({
              heading,
              url: `${SITE_URL}${page > 1 ? `${basePath}?page=${page}` : basePath}`,
              itemList: browseItemListJsonLd(listingsPage.items, offset, listingsPage.total),
            })}
          />
        )}
        <ListingGrid items={listingsPage.items} cityName={cityName ?? "India"} />
        <Pagination currentPage={page} totalPages={Math.max(totalPages, 1)} buildHref={(p) => buildPageHref(basePath, query, p)} />
      </main>
      <Footer currentCityName={cityName} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
