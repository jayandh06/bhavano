import type { Metadata } from "next";
import type { HomeCategoryFilter } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchAreas, fetchCities, fetchListings } from "@/lib/bff";
import { Header } from "@/components/home/Header";
import { AreaFilter } from "@/components/home/AreaFilter";
import { ListingGrid } from "@/components/home/ListingGrid";
import { Footer } from "@/components/home/Footer";
import { HOME_TABS } from "@/lib/homeCategories";
import { isListingCategory, isTransactionType } from "@/lib/browseRoute";
import {
  buildHeading,
  CONDITION_VALUES,
  FURNISHING_VALUES,
  parseEnum,
  parsePositiveInt,
  PROPERTY_TYPE_VALUES,
  SERVICE_TYPE_VALUES,
  SHARING_TYPE_VALUES,
} from "@/lib/seoRoute";

const DEFAULT_LIMIT = 12;
const LOAD_MORE_STEP = 12;

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
  const parsedLimit = typeof sp.limit === "string" ? Number(sp.limit) : NaN;
  const limit = parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;

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

  const listingsPage = await fetchListings(
    {
      homeCategory: category,
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
      limit,
    },
    session?.accessToken,
  );

  const activeTab = HOME_TABS.find((t) => t.value === category) ?? HOME_TABS[0];
  const cityName = resolvedCity?.name ?? "your city";
  const hasMore = listingsPage.items.length < listingsPage.total;
  // Full area list for both the search bar's placeholder hint and the AreaFilter multi-select.
  const cityAreas = resolvedCity ? await fetchAreas(resolvedCity.id, undefined, true) : [];

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

  const loadMoreParams = new URLSearchParams();
  loadMoreParams.set("category", category);
  if (propertyType) loadMoreParams.set("propertyType", propertyType);
  if (q) loadMoreParams.set("q", q);
  if (cityIdParam) loadMoreParams.set("city", cityIdParam);
  if (bedrooms !== undefined) loadMoreParams.set("bedrooms", String(bedrooms));
  if (furnished) loadMoreParams.set("furnished", furnished);
  if (sharingType) loadMoreParams.set("sharingType", sharingType);
  if (condition) loadMoreParams.set("condition", condition);
  if (serviceType) loadMoreParams.set("serviceType", serviceType);
  if (listingCategory) loadMoreParams.set("listingCategory", listingCategory);
  if (transactionType) loadMoreParams.set("transactionType", transactionType);
  if (areaIds && areaIds.length > 0) loadMoreParams.set("areas", areaIds.join(","));
  loadMoreParams.set("limit", String(limit + LOAD_MORE_STEP));
  const loadMoreHref = hasMore ? `/?${loadMoreParams.toString()}` : null;

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery={q}
        activeCategory={category}
        userName={session?.user?.name}
        areaName={cityAreas[0]?.name}
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
        <ListingGrid items={listingsPage.items} cityName={cityName} loadMoreHref={loadMoreHref} />
      </main>
      <Footer />
    </div>
  );
}
