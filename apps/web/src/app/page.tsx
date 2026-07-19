import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { HomeCategoryFilter } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchAreas, fetchCities, fetchListings } from "@/lib/bff";
import { Header } from "@/components/home/Header";
import { AreaFilter } from "@/components/home/AreaFilter";
import { ListingGrid } from "@/components/home/ListingGrid";
import { Pagination } from "@/components/home/Pagination";
import { Footer } from "@/components/home/Footer";
import { resolvePopularSearches } from "@/lib/popularSearches";
import { HOME_TABS } from "@/lib/homeCategories";
import { isListingCategory, isTransactionType } from "@/lib/browseRoute";
import {
  buildHeading,
  CONDITION_VALUES,
  FURNISHING_VALUES,
  parseEnum,
  parsePage,
  parsePositiveInt,
  PROPERTY_TYPE_VALUES,
  SERVICE_TYPE_VALUES,
  SHARING_TYPE_VALUES,
} from "@/lib/seoRoute";

const PAGE_SIZE = 12;

function parseCategory(value: string | string[] | undefined): HomeCategoryFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return HOME_TABS.some((t) => t.value === v) ? (v as HomeCategoryFilter) : "buy";
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
  const cityIdParam = typeof sp.city === "string" ? sp.city : undefined;
  const page = parsePage(sp.page);

  const bedrooms = parsePositiveInt(sp.bedrooms);
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
  const areasQueryParam = typeof sp.areas === "string" ? sp.areas : undefined;
  const areaIds = areasQueryParam ? areasQueryParam.split(",").filter(Boolean) : undefined;

  // Fetched with `all=true` (not just the popular subset) so a tier-2 "more cities" selection
  // still resolves here instead of silently falling back to the default city.
  const [session, allCities] = await Promise.all([auth(), fetchCities(undefined, true)]);
  const popularCities = allCities.filter((c) => c.isPopular);
  const resolvedCity =
    allCities.find((c) => c.id === cityIdParam) ??
    popularCities.find((c) => c.name === "Bengaluru") ??
    popularCities[0];

  const offset = (page - 1) * PAGE_SIZE;
  const listingsPage = await fetchListings(
    {
      homeCategory: category,
      propertyType,
      category: listingCategory,
      transactionType,
      cityId: resolvedCity?.id,
      areaIds,
      q: q || undefined,
      bedrooms: bedrooms !== undefined ? [bedrooms] : undefined,
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
  const cityName = resolvedCity?.name ?? "your city";
  // Full area list for both the search bar's placeholder hint and the AreaFilter multi-select.
  const cityAreas = resolvedCity ? await fetchAreas(resolvedCity.id, undefined, true) : [];
  const popularSearches = await resolvePopularSearches(cityName, resolvedCity?.id);

  const heading = buildHeading({
    fallbackLabel: activeTab.label,
    cityName,
    propertyType,
    bedrooms,
    listingCategory,
    transactionType,
    sharingType,
    condition,
    serviceType,
  });

  function buildPageHref(nextPage: number): string {
    const params = new URLSearchParams();
    params.set("category", category);
    if (propertyType) params.set("propertyType", propertyType);
    if (q) params.set("q", q);
    if (cityIdParam) params.set("city", cityIdParam);
    if (bedrooms !== undefined) params.set("bedrooms", String(bedrooms));
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
    <div className="min-h-screen bg-bg text-text">
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery={q}
        activeCategory={category}
        userName={session?.user?.name}
        areaName={cityAreas[0]?.name}
        popularSearches={popularSearches}
      />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-20">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="font-lora text-[26px] font-semibold m-0 text-text">{heading}</h1>
          <span className="text-[13px] text-muted">Ads shown without login — sign in only to respond</span>
        </div>
        {resolvedCity && (
          <div className="mb-5">
            <AreaFilter cityName={resolvedCity.name} areas={cityAreas} />
          </div>
        )}
        <ListingGrid items={listingsPage.items} cityName={cityName} />
        <Pagination currentPage={page} totalPages={Math.max(totalPages, 1)} buildHref={buildPageHref} />
      </main>
      <Footer allCities={allCities} />
    </div>
  );
}
