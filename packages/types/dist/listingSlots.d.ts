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
    /** What each offered upgrade gives and costs, read from the admin-editable plan settings so the prompt never shows stale numbers. */
    offers?: {
        sellerSlotPack?: {
            totalSlots: number;
            monthlyPrice: number;
        };
        agentPro?: {
            totalSlots: number;
            monthlyPrice: number;
        };
    };
}
/** The cap notice, built in one place so the BFF's publish error and the web post page (which shows it before the form is filled in) agree.
 * Slots only free up when an ad is closed, never by age (docs/plans/explicit-close-not-auto-expire.md), so the text does not promise otherwise. */
export declare function listingSlotCapBody(activeCount: number, allowance: number, settings: SubscriptionPlanSettings): ListingSlotCapErrorBody;
export interface ListingSlotEntitlementInput {
    sellerSlotPackUntil?: Date | string | null;
    agentProUntil?: Date | string | null;
    agentProUnits?: number | null;
}
/** Max concurrent active listings this user may have. */
export declare function listingSlotAllowance(user: ListingSlotEntitlementInput, settings?: SubscriptionPlanSettings): number;
