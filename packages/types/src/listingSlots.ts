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
