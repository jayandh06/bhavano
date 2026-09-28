import type { BoostPlanSelection, BoostPricingPreviewDto } from "./index";
import type { PlatformFeeSettings } from "./platformFeePricing";
import { platformFeeFor } from "./platformFeePricing";
import { boostOptionFor } from "./boostPricing";

/** Rupee total for the publish checkout cart (display only — PaymentsService is authoritative).
 * Platform fee is never promo-discounted; `boostPricing` amounts may already include the active
 * boost/IA discount for display. */
export function listingPublishCheckoutTotalRupees(
  category: Parameters<typeof platformFeeFor>[0],
  platformFeeSettings: PlatformFeeSettings,
  boostPricing: BoostPricingPreviewDto | null,
  boostSelection: BoostPlanSelection | null,
): number {
  let total = platformFeeFor(category, platformFeeSettings);
  if (!boostSelection || !boostPricing) return total;

  // Instant Alerts is included in every boost at no extra charge, so the price depends on the
  // duration alone.
  total += boostOptionFor(boostPricing, boostSelection.duration).amount;
  return total;
}

export function listingPublishRequiresCheckout(
  category: Parameters<typeof platformFeeFor>[0],
  platformFeeSettings: PlatformFeeSettings,
  boostSelection: BoostPlanSelection | null,
): boolean {
  if (platformFeeSettings.allowLivePublishWithPendingPayment) return false;
  return platformFeeFor(category, platformFeeSettings) > 0 || boostSelection !== null;
}
