/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md and,
 * for how the counts became admin-editable, docs/plans/admin-manage-plans-pricing.md. */
import type { SubscriptionPlanSettings } from "./subscriptionPricing";
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
/** Max concurrent active listings this user may have. */
export declare function listingSlotAllowance(user: ListingSlotEntitlementInput, settings?: SubscriptionPlanSettings): number;
