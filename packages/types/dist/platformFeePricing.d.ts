import type { ListingCategory } from "./index";
/** Admin-editable platform fee per category value-tier (same grouping as boost pricing).
 * 0 = no fee for that tier — not shown, not charged, not mandatory. */
export interface PlatformFeeSettings {
    propertyListingFee: number;
    coworkingPgStorageListingFee: number;
    furnitureInteriorsListingFee: number;
    /**
     * When true, new listings go live immediately even if a platform fee is configured or the
     * advertiser selected Boost/IA at publish — the checkout gate is skipped. Existing
     * `pending_checkout` rows are unchanged (still payable or force-publishable). Default false.
     */
    allowLivePublishWithPendingPayment: boolean;
}
export declare const DEFAULT_PLATFORM_FEE_SETTINGS: PlatformFeeSettings;
export declare function platformFeeFor(category: ListingCategory, settings?: PlatformFeeSettings): number;
export declare function platformFeeApplies(category: ListingCategory, settings?: PlatformFeeSettings): boolean;
