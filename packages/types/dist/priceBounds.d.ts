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
export declare const PRICE_BOUNDS: Record<ListingCategory, CategoryPriceBounds>;
