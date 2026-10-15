import type { ListingCategory, SubscriptionTier } from "./index";
import type { BoostDurationDays } from "./boostPricing";
/** The product ids for In-App Purchase on the iOS app — the contract between the app, the server
 * and App Store Connect, in ONE place so they cannot drift apart. Create products in App Store
 * Connect with EXACTLY these ids. See docs/plans/ios-in-app-purchase.md.
 *
 * iOS sells a fixed catalogue at Apple price points. Unlike the web and Android checkout, whose
 * prices are admin-editable per category, duration and listing value, an iOS price is whatever the
 * product is set to in App Store Connect. */
export declare const APPLE_PRODUCT_PREFIX = "com.finfolia.bhavano.";
export interface AppleSubscriptionProduct {
    productId: string;
    tier: SubscriptionTier;
    months: 1 | 6 | 12;
}
export declare const APPLE_SUBSCRIPTIONS: readonly AppleSubscriptionProduct[];
export declare function appleSubscriptionsFor(tier: SubscriptionTier): AppleSubscriptionProduct[];
/** Boosts are two tiers on iOS (the flat web tiers). The web's per-listing-value price bands cannot
 * be expressed as fixed products, so iOS ignores them. */
export type AppleBoostTier = "property" | "other";
export declare const APPLE_BOOST_DAYS: readonly BoostDurationDays[];
/** The boost tier a listing falls in, or null when iOS has no boost product for it (furniture and
 * interiors are paused). */
export declare function appleBoostTierFor(category: ListingCategory): AppleBoostTier | null;
export declare function appleBoostProductId(tier: AppleBoostTier, boostDays: BoostDurationDays): string;
export declare const APPLE_CREDITS_PRODUCT_ID: string;
/** Every product id, subscriptions first. */
export declare const ALL_APPLE_PRODUCT_IDS: readonly string[];
/** Boosts and credit packs are consumables (they can be bought again); plans are subscriptions.
 * Matters when finishing a transaction. */
export declare function isAppleConsumableProductId(productId: string): boolean;
export declare function isAppleProductId(productId: string | undefined | null): boolean;
