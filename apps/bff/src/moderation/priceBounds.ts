import type { ListingCategory, TransactionType } from '@bhavano/types';
import { PRICE_BOUNDS } from '@bhavano/types/priceBounds';

function isSaleType(transactionType: TransactionType): boolean {
  return transactionType === 'buy' || transactionType === 'sell';
}

export function checkPriceSanity(
  category: ListingCategory,
  transactionType: TransactionType,
  price: number,
): string | null {
  const bounds = PRICE_BOUNDS[category][isSaleType(transactionType) ? 'sale' : 'rental'];
  if (price < bounds.min || price > bounds.max) {
    return `Price ₹${price.toLocaleString('en-IN')} is outside the expected range (₹${bounds.min.toLocaleString('en-IN')}–₹${bounds.max.toLocaleString('en-IN')}) for this category`;
  }
  return null;
}
