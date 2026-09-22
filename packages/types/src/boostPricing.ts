import type { BoostPricingOptionDto, BoostPricingPreviewDto, ListingCategory } from "./index";
import type { InstantAlertsPriceSettings } from "./instantAlertsPricing";
import { promoPriceFor } from "./promoCode";

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
export const DEFAULT_BOOST_PRICE_SETTINGS: BoostPriceSettings = {
  propertyBoostPrice7d: 199,
  propertyBoostPrice15d: 349,
  coworkingPgStorageBoostPrice7d: 99,
  coworkingPgStorageBoostPrice15d: 179,
  furnitureInteriorsBoostPrice7d: 49,
  furnitureInteriorsBoostPrice15d: 89,
  showSelectorOnPreview: false,
};

const PROPERTY_CATEGORIES = new Set<ListingCategory>(["house", "apartment", "villa", "plot", "commercial"]);
const MID_VALUE_CATEGORIES = new Set<ListingCategory>(["coworking", "pg", "storage"]);
// furniture/interiors fall through to the remaining low-value tier below.

export function boostPriceFor(
  category: ListingCategory,
  days: BoostDurationDays,
  settings: BoostPriceSettings = DEFAULT_BOOST_PRICE_SETTINGS,
): number {
  const [price7d, price15d] = PROPERTY_CATEGORIES.has(category)
    ? [settings.propertyBoostPrice7d, settings.propertyBoostPrice15d]
    : MID_VALUE_CATEGORIES.has(category)
      ? [settings.coworkingPgStorageBoostPrice7d, settings.coworkingPgStorageBoostPrice15d]
      : [settings.furnitureInteriorsBoostPrice7d, settings.furnitureInteriorsBoostPrice15d];
  return days === 7 ? price7d : price15d;
}

/** Display pricing built from the public, no-login-required settings + active-promo endpoint
 * (`GET /plans/pricing`, `activeDiscountPercent`) — for the ad-preview step's `BoostPlanSelector`,
 * which has to be usable before the advertiser has necessarily logged in (posting an ad only asks
 * for an account at the final "Post ad" tap). `PaymentsService.previewBoostPricing` is the
 * authenticated, personalized equivalent (also resolves per-user redemption caps and the Agent
 * Pro free-credit case) used everywhere else a price is shown post-login — this is deliberately
 * never used to decide what a checkout actually charges, only what the selector displays before
 * that fetch is even possible. `discountPercent` omitted/`null` shows undiscounted prices, same
 * as `previewBoostPricing` would once the code turns out invalid/expired/exhausted. */
export function buildDisplayBoostPricing(
  category: ListingCategory,
  boostSettings: BoostPriceSettings,
  instantAlertsSettings: InstantAlertsPriceSettings,
  discountPercent?: number | null,
): BoostPricingPreviewDto {
  const boost7 = boostPriceFor(category, 7, boostSettings);
  const boost15 = boostPriceFor(category, 15, boostSettings);
  const alerts = instantAlertsSettings.instantAlertsPrice;
  const option = (amount: number): BoostPricingOptionDto =>
    discountPercent
      ? { amount: promoPriceFor(amount, discountPercent), originalAmount: amount, discountApplied: true, free: false }
      : { amount, originalAmount: amount, discountApplied: false, free: false };
  return {
    boost7: option(boost7),
    boost15: option(boost15),
    boost7WithInstantAlerts: option(boost7 + alerts),
    boost15WithInstantAlerts: option(boost15 + alerts),
    showSelectorOnPreview: boostSettings.showSelectorOnPreview,
  };
}
