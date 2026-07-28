/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md */

export const FREE_LISTING_SLOTS = 5;
export const SELLER_SLOT_PACK_TOTAL = 10;
export const PRO_LISTING_SLOTS_PER_UNIT = 20;

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
export function listingSlotAllowance(user: ListingSlotEntitlementInput): number {
  let allowance = FREE_LISTING_SLOTS;

  if (isActive(user.sellerSlotPackUntil)) {
    allowance = Math.max(allowance, SELLER_SLOT_PACK_TOTAL);
  }

  if (isActive(user.agentProUntil)) {
    const units = Math.max(1, user.agentProUnits ?? 1);
    allowance = Math.max(allowance, units * PRO_LISTING_SLOTS_PER_UNIT);
  }

  return allowance;
}
