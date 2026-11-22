import { slugify } from "@bhavano/types/slugify";
import type { ListingCategory, TransactionType } from "@bhavano/types";

/** Where "N people are looking for this" on My listings goes: the Requirements tab narrowed to the ad's city, area,
 * property type and transaction, the same four things the match count is computed from (`listingFits` in the BFF),
 * so the list the owner lands on is the number they were shown. See docs/plans/requirement-matches-for-owners.md. */
export function requirementMatchHref(ad: {
  cityName: string;
  area: string;
  category: ListingCategory;
  transactionType: TransactionType;
}): string {
  const params = new URLSearchParams({ areas: slugify(ad.area), type: ad.category, txn: ad.transactionType });
  return `/requirements/${slugify(ad.cityName)}?${params.toString()}`;
}

/** "1 person is looking for this" / "3 people are looking for this". */
export function requirementMatchText(count: number): string {
  return `${count} ${count === 1 ? "person is" : "people are"} looking for this`;
}
