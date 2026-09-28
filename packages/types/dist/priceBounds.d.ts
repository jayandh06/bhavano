import type { ListingCategory, TransactionType } from "./index";
import { type AreaUnit } from "./areaUnit";
export interface PriceBounds {
    min: number;
    max: number;
}
export interface CategoryPriceBounds {
    sale: PriceBounds;
    rental: PriceBounds;
}
/** Rough plausibility bounds per category (INR) Ã¢ÂÂ originally just a fat-finger/scam-price
 * defense at posting time (see apps/bff/src/moderation/priceBounds.ts), also reused by the web
 * app to build category-aware price quick-picks on browse pages. Sale = buy/sell, rental =
 * rent/lease. Tune as real submissions come in. */
export declare const PRICE_BOUNDS: Record<ListingCategory, CategoryPriceBounds>;
/**
 * Why a listing's price can't be posted, or null. Always judged on the total stored in
 * `Listing.price`, never on a per-unit figure: ₹12,500 per sq ft is a normal house rate, and the
 * ₹1 lakh minimum is for the whole property. When the seller priced per unit, pass what they
 * typed so the message can show the working. Shared by the BFF (the authority) and both post
 * forms, which check before the preview so a seller never learns this after uploading photos.
 */
export declare function listingPriceIssue(category: ListingCategory, transactionType: TransactionType, total: number, perUnit?: {
    price: number;
    area: number;
    unit: AreaUnit;
}): string | null;
