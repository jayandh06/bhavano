import type { SubscriptionTier } from "./index";
/** Buyer-side "Bhavano Plus" — Verified Buyer badge + priority visibility in seller inboxes.
 * See docs/plans/product-pricing-tiers.md. */
export type BuyerPremiumMonths = 1 | 6 | 12;
/** Admin-editable subscription pricing and concurrent-listing-slot counts — same singleton-row
 * convention as RateLimitSettingsDto. Slot counts are bundled in here (not a separate settings
 * object) since they're a property of these same tiers. See
 * docs/plans/admin-manage-plans-pricing.md. */
export interface SubscriptionPlanSettings {
    /** Every seller starts with this many concurrent active listings, no subscription needed. */
    freeListingSlots: number;
    /** Total concurrent slots (not "+N on top of free") once the seller slot pack is active. */
    sellerSlotPackTotalSlots: number;
    sellerSlotPackMonthlyPrice: number;
    /** Per Agent/Broker Pro unit — stackable, see `subscriptionPriceFor`'s `agentProUnits`. */
    proListingSlotsPerUnit: number;
    agentProMonthlyPricePerUnit: number;
    buyerPremiumPrice1Month: number;
    buyerPremiumPrice6Months: number;
    buyerPremiumPrice12Months: number;
}
/** Bundled into this shared package (not just the BFF) since `subscriptionPriceFor`/
 * `listingSlotAllowance` are also called client-side for display, before any live-settings fetch
 * resolves. The BFF's own DB-row fallback reuses this exact same constant rather than
 * redefining it. */
export declare const DEFAULT_SUBSCRIPTION_PLAN_SETTINGS: SubscriptionPlanSettings;
export declare function subscriptionPriceFor(tier: SubscriptionTier, months: number, agentProUnits?: number, settings?: SubscriptionPlanSettings): number;
