import type { SubscriptionTier } from "./index";
import type { MarketId } from "./market";

/** Buyer-side "Bhavano Plus" — Verified Buyer badge + priority visibility in seller inboxes.
 * See docs/plans/product-pricing-tiers.md. */
export type BuyerPremiumMonths = 1 | 6 | 12;

/** Admin-editable subscription pricing and concurrent-listing-slot counts — same singleton-row
 * convention as RateLimitSettingsDto. Slot counts are bundled in here (not a separate settings
 * object) since they're a property of these same tiers. See
 * docs/plans/admin-manage-plans-pricing.md. */
export interface SubscriptionPlanSettings {
  /** Every seller starts with this many concurrent active listings, no subscription needed. */
  freeListingSlots: number;
  /** Total concurrent slots (not "+N on top of free") once the seller slot pack is active. */
  sellerSlotPackTotalSlots: number;
  sellerSlotPackMonthlyPrice: number;
  /** Per Agent/Broker Pro unit — stackable, see `subscriptionPriceFor`'s `agentProUnits`. */
  proListingSlotsPerUnit: number;
  agentProMonthlyPricePerUnit: number;
  buyerPremiumPrice1Month: number;
  buyerPremiumPrice6Months: number;
  buyerPremiumPrice12Months: number;
}

/** Bundled into this shared package (not just the BFF) since `subscriptionPriceFor`/
 * `listingSlotAllowance` are also called client-side for display, before any live-settings fetch
 * resolves. The BFF's own DB-row fallback reuses this exact same constant rather than
 * redefining it. */
export const DEFAULT_SUBSCRIPTION_PLAN_SETTINGS: SubscriptionPlanSettings = {
  freeListingSlots: 5,
  sellerSlotPackTotalSlots: 10,
  sellerSlotPackMonthlyPrice: 149,
  proListingSlotsPerUnit: 20,
  agentProMonthlyPricePerUnit: 499,
  buyerPremiumPrice1Month: 99,
  buyerPremiumPrice6Months: 549,
  buyerPremiumPrice12Months: 899,
};

/** The US price for a rupee price, by the owner's rule (2026-11-25): the rupee amount divided by 60, rounded UP to the next $5 (never below $5).
 * It reproduces the owner's examples: Rs 199 is $5, Rs 799 is $15, Rs 1,200 is $20. The US tiers below are this rule applied to India's amounts;
 * a test keeps them equal, so changing one without the other fails. US prices are separate tiers, not a conversion at runtime. */
export function usdTierFromInr(inr: number): number {
  return Math.max(5, Math.ceil(inr / 60 / 5) * 5);
}

/** The US market's plan prices (US dollars, in the same fields), from `usdTierFromInr` applied to the India defaults. The slot counts are the same. */
export const US_SUBSCRIPTION_PLAN_SETTINGS: SubscriptionPlanSettings = {
  ...DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
  sellerSlotPackMonthlyPrice: 5,
  agentProMonthlyPricePerUnit: 10,
  buyerPremiumPrice1Month: 5,
  buyerPremiumPrice6Months: 10,
  buyerPremiumPrice12Months: 15,
};

/** The default plan settings for a market (India unless another is named): what the BFF writes to a fresh database. */
export function defaultSubscriptionPlanSettings(marketId: MarketId = "in"): SubscriptionPlanSettings {
  return marketId === "us" ? US_SUBSCRIPTION_PLAN_SETTINGS : DEFAULT_SUBSCRIPTION_PLAN_SETTINGS;
}

export function subscriptionPriceFor(
  tier: SubscriptionTier,
  months: number,
  agentProUnits = 1,
  settings: SubscriptionPlanSettings = DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
): number {
  if (tier === "buyerPremium") {
    if (months === 1) return settings.buyerPremiumPrice1Month;
    if (months === 6) return settings.buyerPremiumPrice6Months;
    if (months === 12) return settings.buyerPremiumPrice12Months;
    throw new Error(`Unsupported buyerPremium duration: ${months}`);
  }
  if (tier === "sellerSlotPack") {
    if (months !== 1) throw new Error(`Unsupported sellerSlotPack duration: ${months}`);
    return settings.sellerSlotPackMonthlyPrice * months;
  }
  if (months !== 1) throw new Error(`Unsupported agentPro duration: ${months}`);
  const units = Math.max(1, Math.min(agentProUnits, 20));
  return settings.agentProMonthlyPricePerUnit * units;
}
