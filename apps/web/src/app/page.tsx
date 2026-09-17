import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ListingCategory } from "@bhavano/types";
import { slugify } from "@bhavano/types/slugify";
import { auth } from "@/auth";
import { fetchAreas, fetchCities, fetchListings } from "@/lib/bff";
import { sessionAccessToken, sessionHeaderName } from "@/lib/session";
import { Header } from "@/components/home/Header";
import { segmentsForHomeCategory } from "@/lib/seoRoute";
import { AreaFilter } from "@/components/home/AreaFilter";
import { AssetTypeFilter, TransactionFilter } from "@/components/home/TypeFilters";
import { BhkFilter } from "@/components/home/BhkFilter";
import { hasAssetFilter } from "@/lib/assetFilters";
import { ListingGrid } from "@/components/home/ListingGrid";
import { Pagination } from "@/components/home/Pagination";
import { Footer } from "@/components/home/Footer";
import { resolvePopularSearches } from "@/lib/popularSearches";
import { parseAreaSelection } from "@/lib/areaSelection";
import { PickAnAreaNotice } from "@/components/home/PickAnAreaNotice";
import { SearchTracker } from "@/components/home/SearchTracker";
import { HOME_TABS, type HomeTabValue } from "@/lib/homeCategories";
import { isListingCategory, isTransactionType } from "@/lib/browseRoute";
import {
  buildHeading,
  CONDITION_VALUES,
  FURNISHING_VALUES,
  parseEnum,
  parseIntList,
  parsePage,
  PROPERTY_TYPE_VALUES,
  SERVICE_TYPE_VALUES,
  SHARING_TYPE_VALUES,
} from "@/lib/seoRoute";

const PAGE_SIZE = 12;

function parseCategory(value: string | string[] | undefined): HomeTabValue {
  const v = Array.isArray(value) ? value[0] : value;
  // "all" is the default now: "/" is every city and every category. A visitor arriving with no
  // filters should see the whole marketplace rather than one arbitrary slice of it.
  return HOME_TABS.some((t) => t.value === v) ? (v as HomeTabValue) : "all";
}

// The homepage's own tab/query-string filtering is a UX convenience, not meant to rank
// separately per combination the way the dedicated /{city}/... pages are — every variant
// canonicalizes back to the plain root.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = parseCategory(sp.category);
  const propertyType = parseEnum(sp.propertyType, PROPERTY_TYPE_VALUES);
  const q = typeof sp.q === "string" ? sp.q : "";
  const cityParam = typeof sp.city === "string" ? sp.city : undefined;
  const page = parsePage(sp.page);

  // A list, not a single value: the BHK filter is a multi-select ("2 BHK or 3 BHK"), and a
  // single-value `?bedrooms=3` from a mega-menu link parses as a one-element list unchanged.
  const bedrooms = parseIntList(sp.bedrooms);
  /** The one selected bucket, for the heading's "2 BHK Apartments" subject — meaningless once
   * several are chosen, where the heading names the asset alone. */
  const singleBedroom = bedrooms?.length === 1 ? bedrooms[0] : undefined;
  const furnished = parseEnum(sp.furnished, FURNISHING_VALUES);
  const sharingType = parseEnum(sp.sharingType, SHARING_TYPE_VALUES);
  const condition = parseEnum(sp.condition, CONDITION_VALUES);
  const serviceType = parseEnum(sp.serviceType, SERVICE_TYPE_VALUES);

  // Raw bypass (currently only Furniture's mega-menu links use this, to split Buy vs Rent —
  // the tab-grouped `category`/`propertyType` filter above doesn't distinguish transaction
  // type for the furniture/interiors/pg tabs).
  const listingCategory = typeof sp.listingCategory === "string" && isListingCategory(sp.listingCategory) ? sp.listingCategory : undefined;
  const transactionType = typeof sp.transactionType === "string" && isTransactionType(sp.transactionType) ? sp.transactionType : undefined;

  // AreaFilter's multi-select, homepage mode — always a comma-separated list of area ids.
  // `noAreaSelected` is the visitor having unchecked every area — a real state, not "all", and
  // not a search worth running. See lib/areaSelection.ts.
  const { areaIds, noneSelected: noAreaSelected } = parseAreaSelection(sp.areas);

  // Fetched with `all=true` (not just the popular subset) so a tier-2 "more cities" selection
  // still resolves here instead of silently falling back to the default city.
  const [session, allCities] = await Promise.all([auth(), fetchCities(undefined, true)]);
  const popularCities = allCities.filter((c) => c.isPopular);
  // Slug first — that is what the picker emits and what every other `?city=` in the app uses
  // (/post?city=bengaluru and friends). The id lookup stays as a fallback so links shared or
  // bookmarked while this emitted a cuid keep resolving.
  //
  // No fallback to a remembered or IP-guessed city: "/" is the all-cities view, and only an
  // explicit `?city=` narrows it. A visitor who wants their own city picks it, which puts them
  // on /{city} — a real, linkable address rather than an invisible default.
  const resolvedCity =
    allCities.find((c) => slugify(c.name) === cityParam) ?? allCities.find((c) => c.id === cityParam);

  const offset = (page - 1) * PAGE_SIZE;
  // Nothing selected means there is nothing to ask for — skipping the call is both correct and
  // one fewer uncached query per such page view. See lib/areaSelection.ts.
  const listingsPage = noAreaSelected
    ? { items: [], total: 0, nextCursor: null }
    : await fetchListings(
        {
          homeCategory: category === "all" ? undefined : category,
          propertyType,
          category: listingCategory,
          transactionType,
          cityId: resolvedCity?.id,
          areaIds,
          q: q || undefined,
          bedrooms,
          furnished,
          sharingType,
          condition,
          serviceType,
          offset,
          limit: PAGE_SIZE,
        },
        session?.accessToken,
      );

  // Page 1 with zero results is a normal "nothing here yet" state — only pages *past* the last
  // real page are a crawl-trap/dead-end worth 404ing (see docs/plans/seo-distinct-window-pagination.md).
  const totalPages = Math.ceil(listingsPage.total / PAGE_SIZE);
  if (page > 1 && page > totalPages) notFound();

  const activeTab = HOME_TABS.find((t) => t.value === category) ?? HOME_TABS[0];
  /** The asset the homepage is currently narrowed to, from either spelling — the raw
   * `?listingCategory=` bypass or the tab row's own `?propertyType=`. */
  const homeAsset: ListingCategory | undefined = listingCategory ?? (propertyType as ListingCategory | undefined);
  const cityName = resolvedCity?.name;
  // Full area list for both the search bar's placeholder hint and the AreaFilter multi-select.
  const cityAreas = resolvedCity ? await fetchAreas(resolvedCity.id, undefined, true) : [];
  const popularSearches = await resolvePopularSearches(cityName ?? "India", resolvedCity?.id);

  const heading = buildHeading({
    // Buy/Rent leads, matching how people phrase it. Taken from the active tab via the same
    // mapping the filters use, so the heading and the filter pills always agree.
    transactionGroup: segmentsForHomeCategory(activeTab.value).transactionGroup,
    // The "All" tab's own label is just "All", which reads as a fragment — "All in India". With a
    // verb present the tab label would double up ("Buy Buy"), so the generic noun stands in.
    fallbackLabel:
      activeTab.value === "all"
        ? "All Listings"
        : segmentsForHomeCategory(activeTab.value).transactionGroup && !listingCategory && !propertyType
          ? "Properties"
          : activeTab.label,
    // "India" when no city is selected, so the H1 reads "Rent & Lease in India" rather than
    // dropping the location and leaving a bare category.
    cityName: cityName ?? "India",
    propertyType,
    bedrooms: singleBedroom,
    listingCategory,
    transactionType,
    sharingType,
    condition,
    serviceType,
    // The homepage's own filters, so its H1 describes the view too. It has no price filter.
    furnished,
    areaCount: areaIds && areaIds.length > 1 ? areaIds.length : undefined,
  });

  function buildPageHref(nextPage: number): string {
    const params = new URLSearchParams();
    params.set("category", category);
    if (propertyType) params.set("propertyType", propertyType);
    if (q) params.set("q", q);
    if (resolvedCity) params.set("city", slugify(resolvedCity.name));
    if (bedrooms && bedrooms.length > 0) params.set("bedrooms", bedrooms.join(","));
    if (furnished) params.set("furnished", furnished);
    if (sharingType) params.set("sharingType", sharingType);
    if (condition) params.set("condition", condition);
    if (serviceType) params.set("serviceType", serviceType);
    if (listingCategory) params.set("listingCategory", listingCategory);
    if (transactionType) params.set("transactionType", transactionType);
    if (areaIds && areaIds.length > 0) params.set("areas", areaIds.join(","));
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <Header
        cityName={cityName}
        popularCities={popularCities}
        allCities={allCities}
        searchQuery={q}
        activeCategory={category}
        userName={sessionHeaderName(session)}
        accessToken={sessionAccessToken(session)}
        areaName={cityAreas[0]?.name}
        popularSearches={popularSearches}
      />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-20">
        <h1 className="font-lora text-[26px] font-semibold m-0 mb-1.5 text-text">{heading}</h1>
        {/* Two versions, not one shrunk down. The full paragraph does two jobs — says what
          * Bhavano is, and explains the login model — and neither survives being forced onto one
          * line on a phone: category breadth is already visible in the tabs right below, so
          * restating it is the more droppable half, and the login explanation is no longer load
          * bearing either, now that the login prompt itself only ever appears at the moment it's
          * needed (see the "Ads shown without login" removal) rather than needing to be
          * pre-announced. What's left for mobile is the one line that actually earns its place:
          * the reason to use this over a broker. `truncate` is the real guarantee of a single
          * line — it clips gracefully on the narrowest phones instead of wrapping if the exact
          * copy ever runs long. */}
        <p className="hidden sm:block text-[14px] text-text-soft mb-5">
          Bhavano is India&apos;s classifieds marketplace for buying, selling, renting and leasing
          homes, plots, commercial space, coworking desks, PG stays and furniture. Sign in with
          Google or your phone number only when you want to post a listing, save a favourite, or
          message a seller — we use your account solely to power those features.
        </p>
        <p className="sm:hidden truncate text-[13px] text-text-soft mb-5">
          Buy, rent, sell & lease — free, no brokerage, message sellers directly.
        </p>
        {/* Transaction and asset render here too, and unconditionally — the homepage's "All" tab
          * had no way to narrow by either, which is half of the reported problem. Both navigate
          * to the corresponding browse path, exactly as the tab row above already does, so this
          * introduces no new URL shapes. */}
        <div className="mb-5 flex gap-2.5 flex-wrap items-start">
          {/* Area first when a city is chosen, same reasoning as the browse pages. City itself
            * stays a top-level choice in the header, not a filter — see BrowseListingsView. */}
          {resolvedCity && <AreaFilter cityName={resolvedCity.name} areas={cityAreas} />}
          {/* activeTab.value already *is* the intent here — the homepage's tab row and this
            * filter speak the same vocabulary, so no translation is needed. */}
          <TransactionFilter cityName={resolvedCity?.name} activeIntent={activeTab.value} activeAsset={homeAsset} />
          <AssetTypeFilter cityName={resolvedCity?.name} activeIntent={activeTab.value} activeAsset={homeAsset} />
          {/* 1 BHK … 5+ BHK, once the chosen asset actually has bedrooms per
            * CATEGORY_FIELD_CONFIG. `query` mode because the homepage has no browse path — it
            * writes `?bedrooms=`, which this page has always accepted. */}
          {homeAsset && hasAssetFilter(homeAsset, "bedrooms") && (
            <BhkFilter category={homeAsset} urlMode="query" />
          )}
        </div>
        {/* The homepage expresses every filter as a query param, so without this its searches
            were entirely invisible — a whole session logged one row reading `path: "/"`. */}
        {!noAreaSelected && (
          <SearchTracker
            criteria={{
              path: "/",
              q: q || undefined,
              cityId: resolvedCity?.id,
              areaIds,
              category: listingCategory,
              transactionType,
              // No price filter on the homepage — it lives on the browse pages' filter bar.
              bedrooms,
              furnished,
              resultCount: listingsPage.total,
            }}
          />
        )}
        {noAreaSelected ? (
          <PickAnAreaNotice />
        ) : (
        <ListingGrid
          items={listingsPage.items}
          requirement={{
            label: heading,
            postAdHref: cityName ? `/post?city=${slugify(cityName)}` : "/post",
            criteria: {
              // The homepage's tabs are intent groupings (homeCategory/propertyType) rather than
              // a single category, so only the concrete ones are carried — an admin reading the
              // row still has `searchLabel` and the landing path for the rest.
              category: listingCategory,
              transactionType,
              cityId: resolvedCity?.id,
              bedrooms: singleBedroom,
              landingPath: "/",
            },
          }}
        />
        )}
        {!noAreaSelected && (
          <Pagination currentPage={page} totalPages={Math.max(totalPages, 1)} buildHref={buildPageHref} />
        )}
      </main>
      <Footer currentCityName={resolvedCity?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}
