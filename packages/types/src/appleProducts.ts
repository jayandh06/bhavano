import type { ListingCategory, SubscriptionTier } from "./index";
import type { BoostDurationDays } from "./boostPricing";

/** The product ids for In-App Purchase on the iOS app — the contract between the app, the server
 * and App Store Connect, in ONE place so they cannot drift apart. Create products in App Store
 * Connect with EXACTLY these ids. See docs/plans/ios-in-app-purchase.md.
 *
 * iOS sells a fixed catalogue at Apple price points. Unlike the web and Android checkout, whose
 * prices are admin-editable per category, duration and listing value, an iOS price is whatever the
 * product is set to in App Store Connect. */
export const APPLE_PRODUCT_PREFIX = "com.finfolia.bhavano.";

const id = (suffix: string) => `${APPLE_PRODUCT_PREFIX}${suffix}`;

export interface AppleSubscriptionProduct {
  productId: string;
  tier: SubscriptionTier;
  months: 1 | 6 | 12;
}

export const APPLE_SUBSCRIPTIONS: readonly AppleSubscriptionProduct[] = [
  { productId: id("plus.1m"), tier: "buyerPremium", months: 1 },
  { productId: id("plus.6m"), tier: "buyerPremium", months: 6 },
  { productId: id("plus.12m"), tier: "buyerPremium", months: 12 },
  { productId: id("sellerslots.1m"), tier: "sellerSlotPack", months: 1 },
  // One unit only on iOS: In-App Purchase has no quantity, so the web's stackable units don't carry over.
  { productId: id("agentpro.1m"), tier: "agentPro", months: 1 },
];

export function appleSubscriptionsFor(tier: SubscriptionTier): AppleSubscriptionProduct[] {
  return APPLE_SUBSCRIPTIONS.filter((p) => p.tier === tier);
}

/** Boosts are two tiers on iOS (the flat web tiers). The web's per-listing-value price bands cannot
 * be expressed as fixed products, so iOS ignores them. */
export type AppleBoostTier = "property" | "other";

export const APPLE_BOOST_DAYS: readonly BoostDurationDays[] = [7, 15, 30];

const PROPERTY_CATEGORIES = new Set<ListingCategory>(["house", "apartment", "villa", "plot", "commercial"]);
const OTHER_CATEGORIES = new Set<ListingCategory>(["coworking", "pg", "storage"]);

/** The boost tier a listing falls in, or null when iOS has no boost product for it (furniture and
 * interiors are paused). */
export function appleBoostTierFor(category: ListingCategory): AppleBoostTier | null {
  if (PROPERTY_CATEGORIES.has(category)) return "property";
  if (OTHER_CATEGORIES.has(category)) return "other";
  return null;
}

export function appleBoostProductId(tier: AppleBoostTier, boostDays: BoostDurationDays): string {
  return id(`boost.${tier}.${boostDays}d`);
}

export const APPLE_CREDITS_PRODUCT_ID = id("credits.pack");

/** Every product id, subscriptions first. */
export const ALL_APPLE_PRODUCT_IDS: readonly string[] = [
  ...APPLE_SUBSCRIPTIONS.map((p) => p.productId),
  ...(["property", "other"] as const).flatMap((tier) => APPLE_BOOST_DAYS.map((days) => appleBoostProductId(tier, days))),
  APPLE_CREDITS_PRODUCT_ID,
];

/** Boosts and credit packs are consumables (they can be bought again); plans are subscriptions.
 * Matters when finishing a transaction. */
export function isAppleConsumableProductId(productId: string): boolean {
  return productId.startsWith(id("boost.")) || productId === APPLE_CREDITS_PRODUCT_ID;
}

export function isAppleProductId(productId: string | undefined | null): boolean {
  return !!productId && ALL_APPLE_PRODUCT_IDS.includes(productId);
}
