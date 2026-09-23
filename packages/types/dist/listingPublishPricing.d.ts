import type { BoostPlanSelection, BoostPricingPreviewDto } from "./index";
import type { PlatformFeeSettings } from "./platformFeePricing";
import { platformFeeFor } from "./platformFeePricing";
/** Rupee total for the publish checkout cart (display only — PaymentsService is authoritative).
 * Platform fee is never promo-discounted; `boostPricing` amounts may already include the active
 * boost/IA discount for display. */
export declare function listingPublishCheckoutTotalRupees(category: Parameters<typeof platformFeeFor>[0], platformFeeSettings: PlatformFeeSettings, boostPricing: BoostPricingPreviewDto | null, boostSelection: BoostPlanSelection | null): number;
export declare function listingPublishRequiresCheckout(category: Parameters<typeof platformFeeFor>[0], platformFeeSettings: PlatformFeeSettings, boostSelection: BoostPlanSelection | null): boolean;
