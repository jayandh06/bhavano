import type { ListingCategory } from "./index";

export interface PriceBounds {
  min: number;
  max: number;
}

export interface CategoryPriceBounds {
  sale: PriceBounds;
  rental: PriceBounds;
}

/** Rough plausibility bounds per category (INR) — originally just a fat-finger/scam-price
 * defense at posting time (see apps/bff/src/moderation/priceBounds.ts), also reused by the web
 * app to build category-aware price quick-picks on browse pages. Sale = buy/sell, rental =
 * rent/lease. Tune as real submissions come in. */
export const PRICE_BOUNDS: Record<ListingCategory, CategoryPriceBounds> = {
  house: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  apartment: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  pg: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 100_000 } },
  storage: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 200, max: 100_000 } },
  coworking: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 500, max: 200_000 } },
  furniture: { sale: { min: 50, max: 1_000_000 }, rental: { min: 50, max: 50_000 } },
  // Sell-only (see POSTABLE_TRANSACTION_TYPES) — the `rental` bound is never actually reached.
  interiors: { sale: { min: 500, max: 5_000_000 }, rental: { min: 500, max: 5_000_000 } },
};
