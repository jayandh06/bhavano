import type { ListingCategory, TransactionType } from '@bhavano/types';
import { PRICE_BOUNDS } from '@bhavano/types/priceBounds';
import { PRICE_ON_REQUEST_CATEGORIES } from '@bhavano/types/priceQualifiers';

function isSaleType(transactionType: TransactionType): boolean {
  return transactionType === 'buy' || transactionType === 'sell';
}

export function checkPriceSanity(
  category: ListingCategory,
  transactionType: TransactionType,
  price: number,
): string | null {
  // price: 0 ("Contact for price") is a legitimate, deliberate posting for these categories —
  // ListingsService.assertValidPrice already allows it for exactly this reason. This check ran
  // unconditionally regardless of category, so a genuine price-on-request pg/coworking listing
  // (price: 0, correctly under every category's min bound) was rejected here right after passing
  // assertValidPrice — not scraper-specific, any real user hit this through the normal add/edit
  // UI too.
  if (price === 0 && PRICE_ON_REQUEST_CATEGORIES.has(category)) return null;

  const bounds = PRICE_BOUNDS[category][isSaleType(transactionType) ? 'sale' : 'rental'];
  if (price < bounds.min || price > bounds.max) {
    return `Price ₹${price.toLocaleString('en-IN')} is outside the expected range (₹${bounds.min.toLocaleString('en-IN')}–₹${bounds.max.toLocaleString('en-IN')}) for this category`;
  }
  return null;
}
