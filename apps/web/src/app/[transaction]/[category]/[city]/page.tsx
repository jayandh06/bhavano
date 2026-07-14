import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { City, ListingCategory, TransactionType } from "@bhavano/types";
import { CATEGORY_LABELS, TRANSACTION_LABELS, isListingCategory, isTransactionType, resolveCity } from "@/lib/browseRoute";
import { BrowseListingsView } from "@/components/home/BrowseListingsView";

type RouteParams = { transaction: string; category: string; city: string };

async function resolveRoute(
  params: Promise<RouteParams>,
): Promise<{ transaction: TransactionType; category: ListingCategory; city: string; cityRow: City } | null> {
  const { transaction, category, city } = await params;
  if (!isTransactionType(transaction) || !isListingCategory(category)) return null;
  const cityRow = await resolveCity(city);
  if (!cityRow) return null;
  return { transaction, category, city, cityRow };
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const resolved = await resolveRoute(params);
  if (!resolved) return {};
  const title = `${CATEGORY_LABELS[resolved.category]} ${TRANSACTION_LABELS[resolved.transaction]} in ${resolved.cityRow.name}`;
  return { title, description: `Browse ${title.toLowerCase()} on Bhavano.` };
}

export default async function CityBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await resolveRoute(params);
  if (!resolved) notFound();
  const { transaction, category, city, cityRow } = resolved;

  const sp = await searchParams;
  const pageRaw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return (
    <BrowseListingsView
      transactionType={transaction}
      category={category}
      cityId={cityRow.id}
      cityName={cityRow.name}
      page={page}
      basePath={`/${transaction}/${category}/${city}`}
    />
  );
}
