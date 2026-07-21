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
export const BOOST_PRICE_TIERS: Record<ListingCategory, BoostPriceTier> = {
  // High-value: house, apartment, plot, commercial
  house: { prices: { 7: 199, 15: 349 } },
  apartment: { prices: { 7: 199, 15: 349 } },
  plot: { prices: { 7: 199, 15: 349 } },
  commercial: { prices: { 7: 199, 15: 349 } },
  // Mid-value: coworking, pg, storage
  coworking: { prices: { 7: 99, 15: 179 } },
  pg: { prices: { 7: 99, 15: 179 } },
  storage: { prices: { 7: 99, 15: 179 } },
  // Low-value: furniture, interiors
  furniture: { prices: { 7: 49, 15: 89 } },
  interiors: { prices: { 7: 49, 15: 89 } },
};

export function boostPriceFor(category: ListingCategory, days: BoostDurationDays): number {
  return BOOST_PRICE_TIERS[category].prices[days];
}
