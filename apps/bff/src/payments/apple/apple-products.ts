import type { ListingCategory } from '@bhavano/types';
import type { BoostDurationDays } from '@bhavano/types/boostPricing';

/** The fixed product catalogue for the iOS app.
 *
 * In-App Purchase sells fixed products at Apple price points chosen in App Store Connect, unlike
 * the web and Android checkout, whose prices are admin-editable per category, duration and
 * listing value. So on iOS the server decides the product (never the client), and the price a
 * buyer pays is whatever that product is set to in App Store Connect.
 *
 * The ids below are the contract with App Store Connect: create products with EXACTLY these ids.
 * docs/plans/ios-in-app-purchase.md lists them with their web prices. */
export const APPLE_PRODUCT_PREFIX = 'com.finfolia.bhavano.';

export type AppleProductKind = 'subscription' | 'consumable';

export type AppleProduct =
  | { productId: string; kind: 'subscription'; purpose: 'buyer_premium'; months: 1 | 6 | 12 }
  | { productId: string; kind: 'subscription'; purpose: 'seller_slot_pack'; months: 1 }
  | { productId: string; kind: 'subscription'; purpose: 'agent_pro'; months: 1; units: 1 }
  | { productId: string; kind: 'consumable'; purpose: 'listing_boost'; boostDays: BoostDurationDays; tier: BoostTier }
  | { productId: string; kind: 'consumable'; purpose: 'contact_reveal_credits' };

/** Boosts are two tiers on iOS (the flat web tiers). The web's per-listing-value price bands cannot
 * be expressed as fixed products, so iOS ignores them. */
export type BoostTier = 'property' | 'other';

const id = (suffix: string) => `${APPLE_PRODUCT_PREFIX}${suffix}`;

const BOOST_DAYS: readonly BoostDurationDays[] = [7, 15, 30];

export const APPLE_PRODUCTS: readonly AppleProduct[] = [
  { productId: id('plus.1m'), kind: 'subscription', purpose: 'buyer_premium', months: 1 },
  { productId: id('plus.6m'), kind: 'subscription', purpose: 'buyer_premium', months: 6 },
  { productId: id('plus.12m'), kind: 'subscription', purpose: 'buyer_premium', months: 12 },
  { productId: id('sellerslots.1m'), kind: 'subscription', purpose: 'seller_slot_pack', months: 1 },
  { productId: id('agentpro.1m'), kind: 'subscription', purpose: 'agent_pro', months: 1, units: 1 },
  ...BOOST_DAYS.map(
    (boostDays): AppleProduct => ({
      productId: id(`boost.property.${boostDays}d`),
      kind: 'consumable',
      purpose: 'listing_boost',
      boostDays,
      tier: 'property',
    }),
  ),
  ...BOOST_DAYS.map(
    (boostDays): AppleProduct => ({
      productId: id(`boost.other.${boostDays}d`),
      kind: 'consumable',
      purpose: 'listing_boost',
      boostDays,
      tier: 'other',
    }),
  ),
  { productId: id('credits.pack'), kind: 'consumable', purpose: 'contact_reveal_credits' },
];

const BY_ID = new Map(APPLE_PRODUCTS.map((p) => [p.productId, p]));

export function appleProductById(productId: string | undefined): AppleProduct | undefined {
  return productId ? BY_ID.get(productId) : undefined;
}

const PROPERTY_CATEGORIES = new Set<ListingCategory>(['house', 'apartment', 'villa', 'plot', 'commercial']);
const OTHER_CATEGORIES = new Set<ListingCategory>(['coworking', 'pg', 'storage']);

/** The boost tier a listing falls in, or null when iOS cannot sell a boost for it (furniture and
 * interiors are paused, and have no iOS product). */
export function boostTierFor(category: ListingCategory): BoostTier | null {
  if (PROPERTY_CATEGORIES.has(category)) return 'property';
  if (OTHER_CATEGORIES.has(category)) return 'other';
  return null;
}

export function boostProductId(tier: BoostTier, boostDays: BoostDurationDays): string {
  return id(`boost.${tier}.${boostDays}d`);
}

/** Every subscription product, for the server-notification path, which has to recognise a renewal
 * of a product it did not just sell. */
export function isSubscriptionProduct(productId: string | undefined): boolean {
  return appleProductById(productId)?.kind === 'subscription';
}
