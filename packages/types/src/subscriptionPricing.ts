import type { SubscriptionTier } from "./index";

/** Buyer-side "Bhavano Plus" — Verified Buyer badge + priority visibility in seller inboxes.
 * See docs/plans/product-pricing-tiers.md. */
export type BuyerPremiumMonths = 1 | 6 | 12;

export const BUYER_PREMIUM_PRICE: Record<BuyerPremiumMonths, number> = {
  1: 99,
  6: 549,
  12: 899,
};

/** Seller-side "Agent/Broker Pro" — 20 concurrent slots per unit + storefront. Monthly only. */
export const AGENT_PRO_MONTHLY_PRICE = 499;

/** Individual seller add-on — 10 concurrent slots total (5 free + 5). Monthly only. */
export const SELLER_SLOT_PACK_MONTHLY_PRICE = 149;

export function subscriptionPriceFor(tier: SubscriptionTier, months: number, agentProUnits = 1): number {
  if (tier === "buyerPremium") {
    if (months !== 1 && months !== 6 && months !== 12) {
      throw new Error(`Unsupported buyerPremium duration: ${months}`);
    }
    return BUYER_PREMIUM_PRICE[months];
  }
  if (tier === "sellerSlotPack") {
    if (months !== 1) throw new Error(`Unsupported sellerSlotPack duration: ${months}`);
    return SELLER_SLOT_PACK_MONTHLY_PRICE * months;
  }
  if (months !== 1) throw new Error(`Unsupported agentPro duration: ${months}`);
  const units = Math.max(1, Math.min(agentProUnits, 20));
  return AGENT_PRO_MONTHLY_PRICE * units;
}
