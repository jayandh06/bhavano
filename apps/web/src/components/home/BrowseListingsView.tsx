import { notFound } from "next/navigation";
import type { Area, City, ListingCardDto, ListingCategory } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchListings, type ListingsQuery } from "@/lib/bff";
import { homeCategoryForSegments, type ParsedSegments } from "@/lib/seoRoute";
import { sessionAccessToken } from "@/lib/session";
import { buildListingPath } from "@/lib/listingPath";
import { Header } from "./Header";
import { ListingGrid } from "./ListingGrid";
import { PickAnAreaNotice } from "./PickAnAreaNotice";
import { SearchTracker } from "./SearchTracker";
import { RequirementPrompt } from "./RequirementPrompt";
import { Icon } from "./Icon";
import { AreaFilter } from "./AreaFilter";
import { AssetTypeFilter, TransactionFilter } from "./TypeFilters";
import { hasAssetFilter } from "@/lib/assetFilters";
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
  popularCities,
  userName,
  currentSegments,
  areaName,
  pathAreaName,
  cityAreas,
  allCities,
  noAreaSelected = false,
  filteredHeading,
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
  /** The visitor unchecked every area (`?areas=none`). There is nothing to ask the BFF for, so
   * the fetch is skipped entirely and the grid is replaced by a prompt — see
   * lib/areaSelection.ts. */
  noAreaSelected?: boolean;
  /** The heading including the query-param filters — what the visitor is actually looking at
   * ("Rent Unfurnished Apartments in 4 areas of Bengaluru between ₹20k and ₹2L"). `heading` stays
   * the path-only form and remains what the `<title>` and the SEO copy use, so the indexed title
   * does not acquire a permutation per filter combination. */
  filteredHeading?: string;
}) {
  const session = await auth();
  // The same reverse mapping the tab row uses, so the filter and the highlighted tab can never
  // disagree about which intent this page is. It is also what makes /bengaluru/pg read as "PG"
  // rather than "Any": that path carries no transaction group, only the category.
  const activeIntent = homeCategoryForSegments(currentSegments);
  const offset = (page - 1) * PAGE_SIZE;
  const [listingsPage, popularSearches] = await Promise.all([
    // Nothing selected means there is nothing to ask for — skipping the call is both correct and
    // one fewer uncached query per such page view.
    noAreaSelected
      ? Promise.resolve({ items: [], total: 0, nextCursor: null })
      : fetchListings({ ...query, offset, limit: PAGE_SIZE }, session?.accessToken),
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
        allCities={allCities}
        searchQuery=""
        activeCategory={homeCategoryForSegments(currentSegments)}
        userName={userName}
        accessToken={sessionAccessToken(session)}
        currentSegments={currentSegments}
        areaName={areaName}
        popularSearches={popularSearches}
      />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-20">
        {/* The heading has the line to itself. Sharing it with the count squeezed a long one —
          * "2 BHK Apartments in HSR Layout, Bengaluru" — into a narrow column on a phone and
          * wrapped it to three lines beside a number. */}
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-3 text-text">{filteredHeading ?? heading}</h1>
        {page === 1 && cityName && (
          <BrowseSeoIntro
            heading={heading}
            cityName={cityName}
            areaName={pathAreaName}
            segments={currentSegments}
            listingTotal={listingsPage.total}
            cityAreas={cityAreas}
            part="intro"
          />
        )}
        {/* The All tab shows every category mixed together — none of these filters (transaction,
          * asset type, price, BHK, facets) mean one consistent thing across a PG, a plot, and a
          * sofa all in the same grid, so none of them are offered here. Area is the one exception
          * that would still make sense, but it stays out too for a simpler rule: All means no
          * filter row at all, not "some of them." Picking a real tab is one tap away. */}
        {activeIntent !== "all" && (
          // Its own surface-alt panel rather than sitting directly on the page bg — this row is a
          // distinct control surface (narrowing the results below), not page content, and the flat
          // bg-on-bg treatment it used to have gave it no visual identity of its own.
          <div className="flex gap-2.5 mb-3 flex-wrap items-start bg-surface-alt border border-border rounded-xl p-2.5">
            {/* Says what the strip is. Without it the row reads as a line of unrelated buttons —
              * and which control comes first changes with depth (area inside a city, transaction
              * without one), so the label belongs to the row rather than to any one pill. */}
            <span className="flex items-center gap-1.5 self-center pl-0.5 text-[13px] font-semibold text-muted" aria-hidden>
              <Icon name="filter" /> Filters
            </span>
            <div className="flex gap-2.5 flex-wrap">
              {/* Area first, but only inside a city — it is the question everything else is asked
                * *within*, and the one filter a visitor almost always sets before any other.
                *
                * City is deliberately *not* here. It is a top-level choice, not a filter: it picks
                * which site you are on (and which page ranks), so it lives in the header at every
                * depth via `LocationPicker`. On a national page (`/`, `/buy`) there are no areas to
                * pick, so this row simply starts at the transaction filter rather than repeating the
                * header's city control a second time in a second style. */}
              {cityName && (
                <AreaFilter cityName={cityName} areas={cityAreas} currentSegments={currentSegments} />
              )}
              {/* Then the transaction and asset, at every depth a real tab resolves to (group-root
                * pages included, e.g. /buy or /bengaluru/buy with no asset chosen yet). Everything
                * after them is asset-dependent: BrowseFilterBar's price brackets are sized from
                * PRICE_BOUNDS[category] and BhkFilter only means anything where the config says the
                * asset has bedrooms, so those appear once an asset is chosen rather than guessing a
                * scale that would be wrong for a ₹4,000 sofa and a ₹90L flat at once. See
                * docs/plans/contextual-search-filters.md. */}
              <TransactionFilter
                cityName={cityName}
                areaName={pathAreaName}
                activeIntent={activeIntent}
                activeAsset={currentSegments.category}
              />
              <AssetTypeFilter
                cityName={cityName}
                areaName={pathAreaName}
                activeIntent={activeIntent}
                activeAsset={currentSegments.category}
              />
              {/* Config-driven, not `house || apartment`: CATEGORY_FIELD_CONFIG says villa has
                * bedrooms too, so the BHK filter was simply missing there. See lib/assetFilters.ts. */}
              {/* `cityName` is no longer required: without one BhkFilter builds the national path
                * (/buy/apartment/2bhk), so /buy/apartment is no longer the one apartment page in the
                * site with no BHK filter. */}
              {filterCategory && hasAssetFilter(filterCategory, "bedrooms") && (
                <BhkFilter cityName={cityName} category={filterCategory} currentSegments={currentSegments} />
              )}
              <BrowseFilterBar
                category={filterCategory}
                activeMinPrice={query.minPrice}
                activeMaxPrice={query.maxPrice}
                activeFurnished={query.furnished}
                activeSharingType={query.sharingType}
                activeCondition={query.condition}
                activeServiceType={query.serviceType}
              />
            </div>
          </div>
        )}
        {/* Count and sort share the line directly above the grid: the count reflects whatever
          * the filters above have narrowed it to, and sort is the one control that acts on the
          * results rather than defining them. */}
        {!noAreaSelected && (
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-[13px] text-muted">
              {listingsPage.total} {listingsPage.total === 1 ? "listing" : "listings"}
            </span>
            <SortDropdown activeSort={query.sort} />
          </div>
        )}
        {/* What was searched for and how many results it gave — the only record of either, since
            PageView keeps just the path. Skipped when nothing is selected: that is not a search. */}
        {!noAreaSelected && (
          <SearchTracker
            criteria={{
              path: basePath,
              q: query.q,
              cityId: query.cityId,
              areaIds: query.areaIds ?? (query.areaId ? [query.areaId] : undefined),
              category: query.category,
              transactionType: query.transactionType,
              minPrice: query.minPrice,
              maxPrice: query.maxPrice,
              bedrooms: query.bedrooms,
              furnished: query.furnished,
              sort: query.sort,
              resultCount: listingsPage.total,
            }}
          />
        )}
        {noAreaSelected ? (
          // Deliberately not the requirement capture: that one says "we have nothing here", and
          // this says "you haven't told us where yet". Offering to go and find something before
          // the visitor has named an area would be nonsense.
          <PickAnAreaNotice />
        ) : (
          <>
            {listingsPage.items.length > 0 && (
              <JsonLd
                data={browseCollectionPageJsonLd({
                  heading,
                  url: `${SITE_URL}${page > 1 ? `${basePath}?page=${page}` : basePath}`,
                  itemList: browseItemListJsonLd(listingsPage.items, offset, listingsPage.total),
                })}
              />
            )}
            <ListingGrid
              items={listingsPage.items}
              requirement={{
                label: heading,
                criteria: {
                  category: query.category,
                  transactionType: query.transactionType,
                  cityId: query.cityId,
                  // The single path area when there is one; the multi-select filter is intentionally
                  // not collapsed into one areaId, since "any of these five" is not a requirement.
                  areaId: query.areaId,
                  minPrice: query.minPrice,
                  maxPrice: query.maxPrice,
                  // SavedSearch/Requirement hold one bedroom count, the filter holds a set — take the
                  // smallest, which is the least restrictive reading of "2 or 3 BHK".
                  bedrooms: query.bedrooms?.length ? Math.min(...query.bedrooms) : undefined,
                  landingPath: basePath,
                },
              }}
            />
          </>
        )}
        {!noAreaSelected && (
          <Pagination currentPage={page} totalPages={Math.max(totalPages, 1)} buildHref={(p) => buildPageHref(basePath, query, p)} />
        )}
        {/* Someone who looked at results and left unsatisfied is unmet demand too, and until now
          * nothing captured them — only the zero-result case did. Quiet and below the grid on
          * purpose: it must not compete with the listings someone came to read. */}
        {listingsPage.items.length > 0 && (
          <div className="mt-6 text-center">
            <RequirementPrompt
              variant="inline"
              label={heading}
              criteria={{
                category: query.category,
                transactionType: query.transactionType,
                cityId: query.cityId,
                areaId: query.areaId,
                minPrice: query.minPrice,
                maxPrice: query.maxPrice,
                bedrooms: query.bedrooms?.length ? Math.min(...query.bedrooms) : undefined,
                landingPath: basePath,
              }}
            />
          </div>
        )}
        {/* "Explore nearby" lives here, at the bottom, rather than above the results: a dozen
          * links that send people away had been sitting between the heading and the listings
          * someone came to read. Still server-rendered in the same document, so crawlers see the
          * same links — just after the content instead of ahead of it. */}
        {page === 1 && cityName && (
          <BrowseSeoIntro
            heading={heading}
            cityName={cityName}
            areaName={pathAreaName}
            segments={currentSegments}
            listingTotal={listingsPage.total}
            cityAreas={cityAreas}
            part="links"
          />
        )}
      </main>
      <Footer currentCityName={cityName} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
