import type { HomeCategoryFilter } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchCities, fetchListings } from "@/lib/bff";
import { Header } from "@/components/home/Header";
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

  const [session, popularCities] = await Promise.all([auth(), fetchCities()]);
  const resolvedCity =
    popularCities.find((c) => c.id === cityIdParam) ??
    popularCities.find((c) => c.name === "Bengaluru") ??
    popularCities[0];

  const listingsPage = await fetchListings(
    {
      homeCategory: category,
      propertyType,
      category: listingCategory,
      transactionType,
      cityId: resolvedCity?.id,
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
  loadMoreParams.set("limit", String(limit + LOAD_MORE_STEP));
  const loadMoreHref = hasMore ? `/?${loadMoreParams.toString()}` : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery={q}
        activeCategory={category}
        userName={session?.user?.name}
      />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: 0, color: "var(--text)" }}>
            {heading}
          </h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Ads shown without login — sign in only to respond
          </span>
        </div>
        <ListingGrid items={listingsPage.items} cityName={cityName} loadMoreHref={loadMoreHref} />
      </main>
      <Footer />
    </div>
  );
}
