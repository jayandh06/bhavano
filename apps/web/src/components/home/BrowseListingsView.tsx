import Link from "next/link";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { auth } from "@/auth";
import { fetchListings } from "@/lib/bff";
import { CATEGORY_LABELS, TRANSACTION_LABELS } from "@/lib/browseRoute";
import { ListingGrid } from "./ListingGrid";
import { Footer } from "./Footer";

const PAGE_SIZE = 12;

/** Shared body for the SEO browse-landing pages (city-level and locality-level) — an
 * exact-attribute filtered grid, distinct from the homepage's tab-grouped browsing model. */
export async function BrowseListingsView({
  transactionType,
  category,
  cityId,
  cityName,
  areaId,
  areaName,
  page,
  basePath,
}: {
  transactionType: TransactionType;
  category: ListingCategory;
  cityId: string;
  cityName: string;
  areaId?: string;
  areaName?: string;
  page: number;
  basePath: string;
}) {
  const session = await auth();
  const limit = page * PAGE_SIZE;
  const listingsPage = await fetchListings(
    { transactionType, category, cityId, areaId, limit },
    session?.accessToken,
  );
  const hasMore = listingsPage.items.length < listingsPage.total;
  const loadMoreHref = hasMore ? `${basePath}?page=${page + 1}` : null;

  const heading = `${CATEGORY_LABELS[category]} ${TRANSACTION_LABELS[transactionType]} in ${
    areaName ? `${areaName}, ` : ""
  }${cityName}`;

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
        <ListingGrid items={listingsPage.items} cityName={cityName} loadMoreHref={loadMoreHref} />
      </main>
      <Footer />
    </div>
  );
}
