import type { ListingCategory } from "./index";
/** Admin-editable platform fee per category value-tier (same grouping as boost pricing).
 * 0 = no fee for that tier — not shown, not charged, not mandatory. */
export interface PlatformFeeSettings {
    propertyListingFee: number;
    coworkingPgStorageListingFee: number;
    furnitureInteriorsListingFee: number;
}
export declare const DEFAULT_PLATFORM_FEE_SETTINGS: PlatformFeeSettings;
export declare function platformFeeFor(category: ListingCategory, settings?: PlatformFeeSettings): number;
export declare function platformFeeApplies(category: ListingCategory, settings?: PlatformFeeSettings): boolean;
