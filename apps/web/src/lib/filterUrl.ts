import type { ListingCategory, PropertyTypeFilter } from "@bhavano/types";
import { buildBrowsePath } from "./listingPath";
import { categoryGroupsFor, PROPERTY_TYPE_VALUES, type TransactionGroup } from "./seoRoute";

/**
 * The single place that turns a (transaction, asset) choice into a URL — shared by the transaction
 * and asset filters so the two can never disagree about what a combination means.
 *
 * It exists because the URL grammar cannot express every combination. The grammar is
 * `/{city}[/{area}][/{group}[/{category}[/{facet}]]]`, so **a category only exists underneath a
 * group**: "apartments, no transaction type chosen" has no path to live at. That case therefore
 * falls back to `?propertyType=`, which is not an invention — it is exactly what the homepage's
 * own sub-filter already uses. So the asset choice is a path segment when a transaction is chosen
 * and a query param when it isn't, and both shapes already existed before this function did.
 */
export function buildFilterUrl(params: {
  cityName?: string;
  /** The single area from the path, preserved across filter changes — narrowing by type should
   * not throw away where someone is looking. */
  areaName?: string;
  group?: TransactionGroup;
  asset?: ListingCategory;
  /** Current query string, so price/furnishing/areas/sort survive a type change. */
  searchParams: URLSearchParams;
}): string {
  const { cityName, areaName, group, asset, searchParams } = params;
  const next = new URLSearchParams(searchParams.toString());

  // A filter change always returns to the first page: page 4 of the old result set says nothing
  // about the new one, and is usually past its end.
  next.delete("page");
  // Owned by the path when a group is present, by the query when it isn't — never both, or the
  // two would disagree and the page would have to pick a winner.
  next.delete("propertyType");

  const path = group
    ? buildBrowsePath({ cityName, areaName, transactionGroup: group, category: asset })
    : buildBrowsePath({ cityName, areaName });

  if (!group && asset) {
    // Only the five values the homepage's sub-filter speaks. pg/furniture/interiors are whole
    // tabs of their own and have no query-param representation, so choosing "any transaction"
    // from one of those drops the asset rather than inventing a param the pages don't read.
    if ((PROPERTY_TYPE_VALUES as string[]).includes(asset)) next.set("propertyType", asset as PropertyTypeFilter);
  }

  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The asset to carry across a transaction change, or undefined to drop it.
 *
 * Categories are not universally available in both directions — PG is rent-only, interiors and
 * plots are sell-only (see `categoryGroupsFor`, derived from `POSTABLE_TRANSACTION_TYPES`). So
 * switching from Rent & Lease to Buy while holding "PG" would build `/{city}/buy/pg`: a path that
 * parses, returns nothing, and looks broken. Keeping the asset only where it genuinely exists in
 * the new group is the difference between a filter and a dead end.
 */
export function assetSurvivingGroupChange(
  asset: ListingCategory | undefined,
  nextGroup: TransactionGroup | undefined,
): ListingCategory | undefined {
  if (!asset) return undefined;
  if (!nextGroup) return asset;
  return categoryGroupsFor(asset).includes(nextGroup) ? asset : undefined;
}
