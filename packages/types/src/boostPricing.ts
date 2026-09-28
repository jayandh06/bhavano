import type { BoostPricingOptionDto, BoostPricingPreviewDto, ListingCategory } from "./index";
import { promoPriceFor } from "./promoCode";

export type BoostDurationDays = 7 | 15 | 30;

/** Every duration a seller can buy, shortest first — the one list the pickers render from. */
export const BOOST_DURATIONS: readonly BoostDurationDays[] = [7, 15, 30];

/** Admin-editable boost pricing — same singleton-row convention as RateLimitSettingsDto. Column
 * groups mirror the three category value-tiers this pricing has always used: a flat fee across
 * categories this different in value (a ₹50 furniture listing vs. a multi-crore apartment) would
 * be either exploitative for cheap categories or too cheap to matter for expensive ones. See
 * docs/plans/admin-manage-plans-pricing.md and docs/plans/monetization-boosted-listings-premium-
 * tiers.md. */
export interface BoostPriceSettings {
  propertyBoostPrice7d: number;
  propertyBoostPrice15d: number;
  propertyBoostPrice30d: number;
  coworkingPgStorageBoostPrice7d: number;
  coworkingPgStorageBoostPrice15d: number;
  coworkingPgStorageBoostPrice30d: number;
  furnitureInteriorsBoostPrice7d: number;
  furnitureInteriorsBoostPrice15d: number;
  furnitureInteriorsBoostPrice30d: number;
  /** Where the Boost picker appears: `false` (default) is today's behavior — only
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
  propertyBoostPrice30d: 599,
  coworkingPgStorageBoostPrice7d: 99,
  coworkingPgStorageBoostPrice15d: 179,
  coworkingPgStorageBoostPrice30d: 299,
  furnitureInteriorsBoostPrice7d: 49,
  furnitureInteriorsBoostPrice15d: 89,
  furnitureInteriorsBoostPrice30d: 149,
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
  const [price7d, price15d, price30d] = PROPERTY_CATEGORIES.has(category)
    ? [settings.propertyBoostPrice7d, settings.propertyBoostPrice15d, settings.propertyBoostPrice30d]
    : MID_VALUE_CATEGORIES.has(category)
      ? [
          settings.coworkingPgStorageBoostPrice7d,
          settings.coworkingPgStorageBoostPrice15d,
          settings.coworkingPgStorageBoostPrice30d,
        ]
      : [
          settings.furnitureInteriorsBoostPrice7d,
          settings.furnitureInteriorsBoostPrice15d,
          settings.furnitureInteriorsBoostPrice30d,
        ];
  return days === 7 ? price7d : days === 15 ? price15d : price30d;
}

/** The option for one duration — so a picker can index by the duration it is showing instead of
 * spelling out `boost7` / `boost15` / `boost30` at every use. */
export function boostOptionFor(
  pricing: Pick<BoostPricingPreviewDto, "boost7" | "boost15" | "boost30">,
  days: BoostDurationDays,
): BoostPricingOptionDto {
  return days === 7 ? pricing.boost7 : days === 15 ? pricing.boost15 : pricing.boost30;
}

/** What a longer boost saves against the 7-day price, for the badge under each option. Computed
 * from the *charged* amounts (any promo already applied), so the figure on screen matches the
 * price next to it: the promo takes the same percentage off every duration, so the saving is the
 * same shape with or without it.
 *
 * "Save ₹125" means: 30 days bought at the 7-day rate would cost ₹424; this costs ₹299.
 * Null when there is nothing honest to say — a free option (Agent Pro credit), a missing price, or
 * a longer option that is not actually cheaper per day. */
export function boostSavings(
  pricing: Pick<BoostPricingPreviewDto, "boost7" | "boost15" | "boost30">,
  days: 15 | 30,
): { perDay: number; rupees: number; percent: number } | null {
  const short = pricing.boost7;
  const long = days === 15 ? pricing.boost15 : pricing.boost30;
  if (!short || !long || short.free || long.free || short.amount <= 0 || long.amount <= 0) return null;
  const atShortRate = Math.round((short.amount / 7) * days);
  const rupees = atShortRate - long.amount;
  if (rupees <= 0) return null;
  return {
    perDay: Math.round(long.amount / days),
    rupees,
    percent: Math.round((rupees / atShortRate) * 100),
  };
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
  discountPercent?: number | null,
): BoostPricingPreviewDto {
  const boost7 = boostPriceFor(category, 7, boostSettings);
  const boost15 = boostPriceFor(category, 15, boostSettings);
  const boost30 = boostPriceFor(category, 30, boostSettings);
  const option = (amount: number): BoostPricingOptionDto =>
    discountPercent
      ? { amount: promoPriceFor(amount, discountPercent), originalAmount: amount, discountApplied: true, free: false }
      : { amount, originalAmount: amount, discountApplied: false, free: false };
  return {
    boost7: option(boost7),
    boost15: option(boost15),
    boost30: option(boost30),
    // Instant Alerts is included in every boost now, at no extra charge — these two exist only so
    // an older app build that still reads them shows the same price as the plain option.
    boost7WithInstantAlerts: option(boost7),
    boost15WithInstantAlerts: option(boost15),
    showSelectorOnPreview: boostSettings.showSelectorOnPreview,
  };
}
