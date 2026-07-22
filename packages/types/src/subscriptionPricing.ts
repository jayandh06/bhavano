import type { SubscriptionTier } from "./index";

/** Buyer-side "Bhavano Plus" — Verified Buyer badge + priority visibility in seller inboxes.
 * Two durations, same as boost pricing's pattern. See
 * docs/plans/monetization-boosted-listings-premium-tiers.md. */
export const BUYER_PREMIUM_PRICE: Record<1 | 12, number> = { 1: 99, 12: 899 };

/** Seller-side "Agent/Broker Pro" — raised posting cap (via RateLimitService bypassing
 * User.agentProUntil) + a branded storefront badge. Monthly only for now. */
export const AGENT_PRO_MONTHLY_PRICE = 499;

export function subscriptionPriceFor(tier: SubscriptionTier, months: number): number {
  if (tier === "buyerPremium") {
    if (months !== 1 && months !== 12) throw new Error(`Unsupported buyerPremium duration: ${months}`);
    return BUYER_PREMIUM_PRICE[months];
  }
  if (months !== 1) throw new Error(`Unsupported agentPro duration: ${months}`);
  return AGENT_PRO_MONTHLY_PRICE;
}
