import type { BoostPricingPreviewDto, ListingCategory } from "./index";
import type { InstantAlertsPriceSettings } from "./instantAlertsPricing";
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
    /** Where the Boost/Instant Alerts picker appears: `false` (default) is today's behavior — only
     * as an upsell after the ad is posted. `true` moves it onto the ad-preview step instead, before
     * posting — the two placements are mutually exclusive, never both at once. See
     * docs/plans/boost-instant-alerts-preview-selector.md. */
    showSelectorOnPreview: boolean;
}
/** Bundled into this shared package (not just the BFF) since `boostPriceFor` below is also
 * called client-side, purely for display, before any live-settings fetch resolves — see
 * BoostProvider.tsx (web) / BoostModal.tsx (mobile). The BFF's own DB-row fallback (when no
 * settings have ever been saved) reuses this exact same constant rather than redefining it. */
export declare const DEFAULT_BOOST_PRICE_SETTINGS: BoostPriceSettings;
export declare function boostPriceFor(category: ListingCategory, days: BoostDurationDays, settings?: BoostPriceSettings): number;
/** Undiscounted display pricing built from the two public, no-login-required singleton-settings
 * rows (`GET /plans/pricing`) — for the ad-preview step's `BoostPlanSelector`, which has to be
 * usable before the advertiser has necessarily logged in (posting an ad only asks for an account
 * at the final "Post ad" tap). `PaymentsService.previewBoostPricing` is the authenticated,
 * personalized equivalent (resolves discount codes and the Agent Pro free-credit case) used
 * everywhere else a price is shown post-login — this is deliberately never used to decide what a
 * checkout actually charges, only what the selector displays before that fetch is even possible. */
export declare function buildDisplayBoostPricing(category: ListingCategory, boostSettings: BoostPriceSettings, instantAlertsSettings: InstantAlertsPriceSettings): BoostPricingPreviewDto;
