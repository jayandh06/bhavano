import type { SubscriptionTier } from "./index";
/** Buyer-side "Bhavano Plus" — Verified Buyer badge + priority visibility in seller inboxes.
 * See docs/plans/product-pricing-tiers.md. */
export type BuyerPremiumMonths = 1 | 6 | 12;
export declare const BUYER_PREMIUM_PRICE: Record<BuyerPremiumMonths, number>;
/** Seller-side "Agent/Broker Pro" — 20 concurrent slots per unit + storefront. Monthly only. */
export declare const AGENT_PRO_MONTHLY_PRICE = 499;
/** Individual seller add-on — 10 concurrent slots total (5 free + 5). Monthly only. */
export declare const SELLER_SLOT_PACK_MONTHLY_PRICE = 149;
export declare function subscriptionPriceFor(tier: SubscriptionTier, months: number, agentProUnits?: number): number;
