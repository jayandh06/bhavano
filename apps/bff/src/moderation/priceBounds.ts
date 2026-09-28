import type { ListingCategory, TransactionType } from '@bhavano/types';
import { listingPriceIssue } from '@bhavano/types/priceBounds';

/** price: 0 ("Contact for price") is a legitimate, deliberate posting for price-on-request
 * categories — ListingsService.assertValidPrice already allows it, and so does this. `price` is
 * the stored total; a per-unit listing's total is checked in ListingsService with the per-unit
 * working, see listingPriceIssue. */
export function checkPriceSanity(
  category: ListingCategory,
  transactionType: TransactionType,
  price: number,
): string | null {
  return listingPriceIssue(category, transactionType, price);
}
