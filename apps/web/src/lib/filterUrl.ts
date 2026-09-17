import type { ListingCategory } from "@bhavano/types";
import { buildBrowsePath } from "./listingPath";
import { type TransactionGroup } from "./seoRoute";

/**
 * The single place that turns a (transaction, asset) choice into a URL — shared by the transaction
 * and asset filters so the two can never disagree about what a combination means.
 *
 * The one rule worth stating: **a category may appear with or without a group**. `parseSegments`
 * accepts a bare category segment, which is what makes `/bengaluru/furniture` a real page —
 * furniture is postable as both sell and rent, so forcing it under a group would hide half its
 * listings. An earlier version of this function believed the opposite and fell back to
 * `?propertyType=` whenever no group was chosen; since furniture is not one of that param's five
 * values, **selecting Furniture in the transaction filter silently did nothing** — it dropped the
 * category and navigated to the city root.
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
  // The asset lives in the path, so a `?propertyType=` carried in from an older link (the
  // homepage's own sub-filter emits them) would be a second, competing answer to the same
  // question.
  next.delete("propertyType");

  // One call for every combination — group with asset, group alone, asset alone, neither.
  // buildBrowsePath already drops a group that the category implies, so /bengaluru/rent-lease/pg
  // still shortens to /bengaluru/pg.
  const path = buildBrowsePath({ cityName, areaName, transactionGroup: group, category: asset });

  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}
