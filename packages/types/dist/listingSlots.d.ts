/** Concurrent active listing caps — see docs/plans/listing-slots-seller-notifications.md */
export declare const FREE_LISTING_SLOTS = 5;
export declare const SELLER_SLOT_PACK_TOTAL = 10;
export declare const PRO_LISTING_SLOTS_PER_UNIT = 20;
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
export declare function listingSlotAllowance(user: ListingSlotEntitlementInput): number;
