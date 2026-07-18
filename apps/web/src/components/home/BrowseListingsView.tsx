import Link from "next/link";
import type { ListingCategory } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchListings, type ListingsQuery } from "@/lib/bff";
import { ListingGrid } from "./ListingGrid";
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
}) {
  const session = await auth();
  const limit = page * PAGE_SIZE;
  const listingsPage = await fetchListings({ ...query, limit }, session?.accessToken);
  const hasMore = listingsPage.items.length < listingsPage.total;

  const loadMoreParams = new URLSearchParams();
  if (query.minPrice !== undefined) loadMoreParams.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) loadMoreParams.set("maxPrice", String(query.maxPrice));
  if (query.furnished) loadMoreParams.set("furnished", query.furnished);
  loadMoreParams.set("page", String(page + 1));
  const loadMoreHref = hasMore ? `${basePath}?${loadMoreParams.toString()}` : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ padding: "20px 32px 0" }}>
        <Link
          href="/"
          style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 18, color: "var(--green)" }}
        >
          Bhavano
        </Link>
      </div>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-lora)", fontSize: 26, fontWeight: 600, margin: 0, color: "var(--text)" }}>
            {heading}
          </h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{listingsPage.total} listings</span>
        </div>
        <BrowseFilterBar
          category={filterCategory}
          isSale={filterIsSale ?? true}
          activeMinPrice={query.minPrice}
          activeMaxPrice={query.maxPrice}
          activeFurnished={query.furnished}
        />
        <ListingGrid items={listingsPage.items} cityName={cityName} loadMoreHref={loadMoreHref} />
      </main>
      <Footer />
    </div>
  );
}
