import type { ListingCategory } from "./index";

/** Admin-editable platform fee per category value-tier (same grouping as boost pricing).
 * 0 = no fee for that tier — not shown, not charged, not mandatory. */
export interface PlatformFeeSettings {
  propertyListingFee: number;
  coworkingPgStorageListingFee: number;
  furnitureInteriorsListingFee: number;
}

export const DEFAULT_PLATFORM_FEE_SETTINGS: PlatformFeeSettings = {
  propertyListingFee: 0,
  coworkingPgStorageListingFee: 0,
  furnitureInteriorsListingFee: 0,
};

const PROPERTY_CATEGORIES = new Set<ListingCategory>(["house", "apartment", "villa", "plot", "commercial"]);
const MID_VALUE_CATEGORIES = new Set<ListingCategory>(["coworking", "pg", "storage"]);

export function platformFeeFor(
  category: ListingCategory,
  settings: PlatformFeeSettings = DEFAULT_PLATFORM_FEE_SETTINGS,
): number {
  if (PROPERTY_CATEGORIES.has(category)) return settings.propertyListingFee;
  if (MID_VALUE_CATEGORIES.has(category)) return settings.coworkingPgStorageListingFee;
  return settings.furnitureInteriorsListingFee;
}

export function platformFeeApplies(
  category: ListingCategory,
  settings: PlatformFeeSettings = DEFAULT_PLATFORM_FEE_SETTINGS,
): boolean {
  return platformFeeFor(category, settings) > 0;
}
