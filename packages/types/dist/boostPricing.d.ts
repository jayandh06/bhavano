import type { ListingCategory } from "./index";
export type BoostDurationDays = 7 | 15;
export interface BoostPriceTier {
    /** Price in INR (rupees, not paise) per supported boost duration — the payments module
     * converts to paise at order-creation time, since that's the unit Razorpay's API expects. */
    prices: Record<BoostDurationDays, number>;
}
/** Category-tiered boost pricing — a flat fee across categories this different in value (a ₹50
 * furniture listing vs. a multi-crore apartment) would be either exploitative for cheap
 * categories or too cheap to matter for expensive ones. See
 * docs/plans/monetization-boosted-listings-premium-tiers.md. Tune as real usage comes in. */
export declare const BOOST_PRICE_TIERS: Record<ListingCategory, BoostPriceTier>;
export declare function boostPriceFor(category: ListingCategory, days: BoostDurationDays): number;
