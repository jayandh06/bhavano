import type { ListingCategory } from "./index";
export type BoostDurationDays = 7 | 15;
/** Admin-editable boost pricing — same singleton-row convention as RateLimitSettingsDto. Column
 * groups mirror the three category value-tiers this pricing has always used: a flat fee across
 * categories this different in value (a ₹50 furniture listing vs. a multi-crore apartment) would
 * be either exploitative for cheap categories or too cheap to matter for expensive ones. See
 * docs/plans/admin-manage-plans-pricing.md and docs/plans/monetization-boosted-listings-premium-
 * tiers.md. */
export interface BoostPriceSettings {
    propertyBoostPrice7d: number;
    propertyBoostPrice15d: number;
    coworkingPgStorageBoostPrice7d: number;
    coworkingPgStorageBoostPrice15d: number;
    furnitureInteriorsBoostPrice7d: number;
    furnitureInteriorsBoostPrice15d: number;
}
/** Bundled into this shared package (not just the BFF) since `boostPriceFor` below is also
 * called client-side, purely for display, before any live-settings fetch resolves — see
 * BoostProvider.tsx (web) / BoostModal.tsx (mobile). The BFF's own DB-row fallback (when no
 * settings have ever been saved) reuses this exact same constant rather than redefining it. */
export declare const DEFAULT_BOOST_PRICE_SETTINGS: BoostPriceSettings;
export declare function boostPriceFor(category: ListingCategory, days: BoostDurationDays, settings?: BoostPriceSettings): number;
