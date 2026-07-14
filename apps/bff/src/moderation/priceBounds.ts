import type { ListingCategory, TransactionType } from '@bhavano/types';

interface Bounds {
  min: number;
  max: number;
}

interface CategoryBounds {
  sale: Bounds;
  rental: Bounds;
}

/** Rough plausibility bounds per category (INR) — a defense against fat-finger and scam
 * pricing, not a real valuation model. Sale = buy/sell, rental = rent/lease. Tune as real
 * submissions come in. */
const PRICE_BOUNDS: Record<ListingCategory, CategoryBounds> = {
  house: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  apartment: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  pg: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 100_000 } },
  storage: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 200, max: 100_000 } },
  coworking: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 500, max: 200_000 } },
  furniture: { sale: { min: 50, max: 1_000_000 }, rental: { min: 50, max: 50_000 } },
};

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
