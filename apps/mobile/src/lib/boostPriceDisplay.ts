import type { BoostPricingPreviewDto } from "@bhavano/types";

/**
 * Pulled out of PostAdWizard.tsx (the iOS success-screen price teaser) so this arithmetic is
 * testable without importing that file — which pulls in react-native, expo-image-picker,
 * expo-web-browser and the rest of the wizard's native-module graph just to reach two pure
 * functions.
 */
export type PriceLike = { amount: number; originalAmount: number; discountApplied: boolean; free: boolean };

export function priceSuffix(opt?: PriceLike): string {
  if (!opt) return "";
  if (opt.free) return " — Free";
  return opt.discountApplied && opt.originalAmount > opt.amount
    ? ` — ₹${opt.originalAmount} → ₹${opt.amount}`
    : ` — ₹${opt.amount}`;
}

/** There is no standalone "instant alerts only" pricing preview (`boost-pricing-preview` only
 * returns boost-inclusive combos) — derived from the same live call BoostBundleCard already
 * makes rather than adding a new endpoint just for this teaser price. Returns null rather than a
 * misleading number in the one case the subtraction doesn't hold: a free Agent Pro boost credit,
 * which bundling with Instant Alerts deliberately bypasses (see PaymentsService.createBoostOrder),
 * so `boost7WithInstantAlerts.amount - boost7.amount` would equal the whole bundle price, not the
 * alerts increment. */
export function instantAlertsOnlyPrice(pricing: BoostPricingPreviewDto | null): PriceLike | null {
  if (!pricing || pricing.boost7.free || pricing.boost7WithInstantAlerts.free) return null;
  return {
    amount: pricing.boost7WithInstantAlerts.amount - pricing.boost7.amount,
    originalAmount: pricing.boost7WithInstantAlerts.originalAmount - pricing.boost7.originalAmount,
    discountApplied: pricing.boost7WithInstantAlerts.discountApplied,
    free: false,
  };
}
