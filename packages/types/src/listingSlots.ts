/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md and,
 * for how the counts became admin-editable, docs/plans/admin-manage-plans-pricing.md. */

import type { SubscriptionPlanSettings } from "./subscriptionPricing";
import { DEFAULT_SUBSCRIPTION_PLAN_SETTINGS } from "./subscriptionPricing";

export type ListingSlotUpsell = "sellerSlotPack" | "agentPro";

export interface ListingSlotCapErrorBody {
  code: "LISTING_SLOT_CAP_REACHED";
  message: string;
  activeCount: number;
  allowance: number;
  upsell: ListingSlotUpsell[];
  /** What each offered upgrade gives and costs, read from the admin-editable plan settings so the prompt never shows stale numbers. */
  offers?: { sellerSlotPack?: { totalSlots: number; monthlyPrice: number }; agentPro?: { totalSlots: number; monthlyPrice: number } };
}

/** The cap notice, built in one place so the BFF's publish error and the web post page (which shows it before the form is filled in) agree.
 * Slots only free up when an ad is closed, never by age (docs/plans/explicit-close-not-auto-expire.md), so the text does not promise otherwise. */
export function listingSlotCapBody(activeCount: number, allowance: number, settings: SubscriptionPlanSettings): ListingSlotCapErrorBody {
  // Below the seller slot pack's own ceiling that upgrade alone would still help; at or above it only Pro adds room.
  const packHelps = allowance < settings.sellerSlotPackTotalSlots;
  return {
    code: "LISTING_SLOT_CAP_REACHED",
    message: `You have ${activeCount} active ads and your plan allows ${allowance}. Close an ad you no longer need, or upgrade for more slots.`,
    activeCount,
    allowance,
    upsell: packHelps ? ["sellerSlotPack", "agentPro"] : ["agentPro"],
    offers: {
      ...(packHelps ? { sellerSlotPack: { totalSlots: settings.sellerSlotPackTotalSlots, monthlyPrice: settings.sellerSlotPackMonthlyPrice } } : {}),
      agentPro: { totalSlots: settings.proListingSlotsPerUnit, monthlyPrice: settings.agentProMonthlyPricePerUnit },
    },
  };
}

export interface ListingSlotEntitlementInput {
  sellerSlotPackUntil?: Date | string | null;
  agentProUntil?: Date | string | null;
  agentProUnits?: number | null;
}

function isActive(until: Date | string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now();
}

/** Max concurrent active listings this user may have. */
export function listingSlotAllowance(
  user: ListingSlotEntitlementInput,
  settings: SubscriptionPlanSettings = DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
): number {
  let allowance = settings.freeListingSlots;

  if (isActive(user.sellerSlotPackUntil)) {
    allowance = Math.max(allowance, settings.sellerSlotPackTotalSlots);
  }

  if (isActive(user.agentProUntil)) {
    const units = Math.max(1, user.agentProUnits ?? 1);
    allowance = Math.max(allowance, units * settings.proListingSlotsPerUnit);
  }

  return allowance;
}
