import type { ListingCategory } from '@bhavano/types';
import type { BoostDurationDays } from '@bhavano/types/boostPricing';
import {
  APPLE_BOOST_DAYS,
  APPLE_CREDITS_PRODUCT_ID,
  APPLE_PRODUCT_PREFIX,
  APPLE_SUBSCRIPTIONS,
  appleBoostProductId,
  appleBoostTierFor,
  type AppleBoostTier,
} from '@bhavano/types/appleProducts';

/** What each Apple product MEANS to the server: which purchase it fulfils and how. The ids and the
 * boost-tier rules live in `@bhavano/types/appleProducts`, shared with the app, so the two cannot
 * disagree about what a product id is. The server decides the product for a purchase; the client
 * never names one. */
export { APPLE_PRODUCT_PREFIX };
export type BoostTier = AppleBoostTier;

export type AppleProductKind = 'subscription' | 'consumable';

export type AppleProduct =
  | { productId: string; kind: 'subscription'; purpose: 'buyer_premium'; months: 1 | 6 | 12 }
  | { productId: string; kind: 'subscription'; purpose: 'seller_slot_pack'; months: 1 }
  | { productId: string; kind: 'subscription'; purpose: 'agent_pro'; months: 1; units: 1 }
  | { productId: string; kind: 'consumable'; purpose: 'listing_boost'; boostDays: BoostDurationDays; tier: BoostTier }
  | { productId: string; kind: 'consumable'; purpose: 'contact_reveal_credits' };

function subscriptionProduct(p: (typeof APPLE_SUBSCRIPTIONS)[number]): AppleProduct {
  if (p.tier === 'buyerPremium') return { productId: p.productId, kind: 'subscription', purpose: 'buyer_premium', months: p.months };
  if (p.tier === 'sellerSlotPack') return { productId: p.productId, kind: 'subscription', purpose: 'seller_slot_pack', months: 1 };
  return { productId: p.productId, kind: 'subscription', purpose: 'agent_pro', months: 1, units: 1 };
}

export const APPLE_PRODUCTS: readonly AppleProduct[] = [
  ...APPLE_SUBSCRIPTIONS.map(subscriptionProduct),
  ...(['property', 'other'] as const).flatMap((tier) =>
    APPLE_BOOST_DAYS.map(
      (boostDays): AppleProduct => ({
        productId: appleBoostProductId(tier, boostDays),
        kind: 'consumable',
        purpose: 'listing_boost',
        boostDays,
        tier,
      }),
    ),
  ),
  { productId: APPLE_CREDITS_PRODUCT_ID, kind: 'consumable', purpose: 'contact_reveal_credits' },
];

const BY_ID = new Map(APPLE_PRODUCTS.map((p) => [p.productId, p]));

export function appleProductById(productId: string | undefined): AppleProduct | undefined {
  return productId ? BY_ID.get(productId) : undefined;
}

/** The boost tier a listing falls in, or null when iOS cannot sell a boost for it. */
export function boostTierFor(category: ListingCategory): BoostTier | null {
  return appleBoostTierFor(category);
}

export function boostProductId(tier: BoostTier, boostDays: BoostDurationDays): string {
  return appleBoostProductId(tier, boostDays);
}
