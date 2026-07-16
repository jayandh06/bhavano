import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchCities, fetchListings } from "@/lib/bff";
import { Header } from "@/components/home/Header";
import { FilterBar } from "@/components/home/FilterBar";
import { ListingGrid } from "@/components/home/ListingGrid";
import { Footer } from "@/components/home/Footer";
import { HOME_TABS } from "@/lib/homeCategories";

const DEFAULT_LIMIT = 12;
const LOAD_MORE_STEP = 12;
const FURNISHING_VALUES = ["unfurnished", "semi", "furnished"];

function parsePositiveInt(value: string | string[] | undefined): number | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) && n >= 0 ? n : undefined;
}

function parseCategory(value: string | string[] | undefined): HomeCategoryFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return HOME_TABS.some((t) => t.value === v) ? (v as HomeCategoryFilter) : "buy";
}

function parsePropertyType(
  value: string | string[] | undefined,
  tab: HomeCategoryFilter,
): PropertyTypeFilter | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const activeTab = HOME_TABS.find((t) => t.value === tab);
  return activeTab?.propertyTypes.some((pt) => pt.value === v) ? (v as PropertyTypeFilter) : undefined;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = parseCategory(sp.category);
  const propertyType = parsePropertyType(sp.propertyType, category);
  const q = typeof sp.q === "string" ? sp.q : "";
  const cityIdParam = typeof sp.city === "string" ? sp.city : undefined;
  const parsedLimit = typeof sp.limit === "string" ? Number(sp.limit) : NaN;
  const limit = parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;

  const minPrice = parsePositiveInt(sp.minPrice);
  const maxPrice = parsePositiveInt(sp.maxPrice);
  const bedrooms = parsePositiveInt(sp.bedrooms);
  const furnished = typeof sp.furnished === "string" && FURNISHING_VALUES.includes(sp.furnished) ? sp.furnished : undefined;

  const [session, popularCities] = await Promise.all([auth(), fetchCities()]);
  const resolvedCity =
    popularCities.find((c) => c.id === cityIdParam) ??
    popularCities.find((c) => c.name === "Bengaluru") ??
    popularCities[0];

  const listingsPage = await fetchListings(
    {
      homeCategory: category,
      propertyType,
      cityId: resolvedCity?.id,
      q: q || undefined,
      minPrice,
      maxPrice,
      bedrooms,
      furnished: furnished as "unfurnished" | "semi" | "furnished" | undefined,
      limit,
    },
    session?.accessToken,
  );

  const categoryLabel = HOME_TABS.find((t) => t.value === category)?.label ?? "Buy";
  const cityName = resolvedCity?.name ?? "your city";
  const hasMore = listingsPage.items.length < listingsPage.total;

  const loadMoreParams = new URLSearchParams();
  loadMoreParams.set("category", category);
  if (propertyType) loadMoreParams.set("propertyType", propertyType);
  if (q) loadMoreParams.set("q", q);
  if (cityIdParam) loadMoreParams.set("city", cityIdParam);
  if (minPrice !== undefined) loadMoreParams.set("minPrice", String(minPrice));
  if (maxPrice !== undefined) loadMoreParams.set("maxPrice", String(maxPrice));
  if (bedrooms !== undefined) loadMoreParams.set("bedrooms", String(bedrooms));
  if (furnished) loadMoreParams.set("furnished", furnished);
  loadMoreParams.set("limit", String(limit + LOAD_MORE_STEP));
  const loadMoreHref = hasMore ? `/?${loadMoreParams.toString()}` : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <Header
        cityName={cityName}
        popularCities={popularCities}
        searchQuery={q}
        activeCategory={category}
        activePropertyType={propertyType}
        userName={session?.user?.name}
      />
      <FilterBar
        resultsCount={listingsPage.total}
        cityName={cityName}
        activeMinPrice={minPrice}
        activeMaxPrice={maxPrice}
        activeBedrooms={bedrooms}
        activeFurnished={furnished}
      />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: 0, color: "var(--text)" }}>
            {categoryLabel} in {cityName}
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
