"use server";

import type {
  BoostPricingPreviewDto,
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateListingPublishOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
  ListingCategory,
  ListingDetailDto,
  SubscriptionTier,
} from "@bhavano/types";
import type { BoostDurationDays, BoostPriceSettings } from "@bhavano/types/boostPricing";
import type { BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { ACTIVE_PROMO_CODE } from "@bhavano/types/promoCode";
import { parsePurchaseSource, type PurchaseSource } from "@bhavano/types/purchaseSource";
import { auth } from "@/auth";
import {
  cancelListingPublishCheckout,
  createBoostOrder,
  createContactRevealCreditsOrder,
  createListingPublishOrder,
  createSubscriptionOrder,
  fetchPlanPricing,
  previewBoostPricing,
} from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";

/** Called from BoostProvider (a client component) when the boost picker actually opens — not
 * from the root layout, which would otherwise put a BFF round-trip on the critical path of every
 * single page view for a modal most visitors never open. See
 * docs/plans/admin-manage-plans-pricing.md. */
export async function fetchBoostPricingAction(): Promise<BoostPriceSettings> {
  const { boost } = await fetchPlanPricing();
  return boost;
}

/** Same reasoning as fetchBoostPricingAction — called from PostAdWizard's Preview-step selector,
 * which (unlike the post-creation BoostBundlePicker) has to compute a discounted display price
 * before the advertiser is necessarily logged in, so it can't use previewBoostPricingAction's
 * personalized, per-user-redemption-aware resolution. `null` means the active promo code isn't
 * usable right now (inactive, expired, or its total redemption cap is spent) — see
 * PlansController.getActiveDiscountPercent. */
export async function fetchActiveBoostDiscountPercentAction(): Promise<number | null> {
  const { activeDiscountPercent } = await fetchPlanPricing();
  return activeDiscountPercent;
}

export async function fetchPostAdPlanPricingAction(): Promise<{
  boost: BoostPriceSettings;
  instantAlerts: InstantAlertsPriceSettings;
  platformFee: PlatformFeeSettings;
  activeDiscountPercent: number | null;
  boostEffectiveness: BoostEffectivenessDto | null;
}> {
  const { boost, instantAlerts, platformFee, activeDiscountPercent, boostEffectiveness } = await fetchPlanPricing();
  return { boost, instantAlerts, platformFee, activeDiscountPercent, boostEffectiveness };
}

export type CreateBoostOrderResult = { success: true; order: CreateBoostOrderResponseDto } | { success: false; error: string };

export async function createBoostOrderAction(
  listingId: string,
  boostDays: BoostDurationDays,
  discountCode?: string,
  includeInstantAlerts?: boolean,
  source?: PurchaseSource,
): Promise<CreateBoostOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createBoostOrder(
      session.accessToken,
      listingId,
      boostDays,
      discountCode,
      includeInstantAlerts,
      parsePurchaseSource(source),
    );
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start checkout" };
  }
}

/** Spends the user's soonest-expiring free referral boost on this listing. Activates immediately
 * (no payment); the boost length is the credit's own, so the `7` sent here is only there to pass
 * the order DTO's validation. */
export async function redeemReferralBoostAction(listingId: string, source?: PurchaseSource): Promise<CreateBoostOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createBoostOrder(
      session.accessToken,
      listingId,
      7,
      undefined,
      true,
      parsePurchaseSource(source),
      true,
    );
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Couldn't use your free Feature" };
  }
}

// The auto-applied promo now lives in @bhavano/types/promoCode — the BFF quotes the same code's
// price in the admin-sent Boost promotion email, and three copies of one string is how they drift.

export type PreviewBoostPricingResult =
  | { success: true; pricing: BoostPricingPreviewDto }
  | { success: false; error: string };

export async function previewBoostPricingAction(
  category: ListingCategory,
  listingId?: string,
): Promise<PreviewBoostPricingResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const pricing = await previewBoostPricing(session.accessToken, category, ACTIVE_PROMO_CODE, listingId);
    return { success: true, pricing };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load pricing" };
  }
}

/** The bundle picker's own "Pay" action always passes the same auto-applied promo the preview
 * already showed the price for — kept as its own export so the picker never has to know the
 * literal code string. */
export async function createBoostBundleOrderAction(
  listingId: string,
  boostDays: BoostDurationDays,
  includeInstantAlerts: boolean,
  source?: PurchaseSource,
): Promise<CreateBoostOrderResult> {
  return createBoostOrderAction(listingId, boostDays, ACTIVE_PROMO_CODE, includeInstantAlerts, source);
}

export type CreateListingPublishOrderResult =
  | { success: true; order: CreateListingPublishOrderResponseDto }
  | { success: false; error: string };

export async function createListingPublishOrderAction(
  listingId: string,
  boostDays?: BoostDurationDays,
  includeInstantAlerts?: boolean,
): Promise<CreateListingPublishOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createListingPublishOrder(
      session.accessToken,
      listingId,
      boostDays,
      includeInstantAlerts,
      ACTIVE_PROMO_CODE,
    );
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start checkout" };
  }
}

export type CancelListingPublishCheckoutResult =
  | { success: true; listing: ListingDetailDto }
  | { success: false; error: string };

/** "Post without Featured" after backing out of the publish checkout — see
 * PaymentsService.cancelListingPublishCheckout. */
export async function cancelListingPublishCheckoutAction(
  listingId: string,
): Promise<CancelListingPublishCheckoutResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const listing = await cancelListingPublishCheckout(session.accessToken, listingId);
    return { success: true, listing };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to post the ad" };
  }
}

export type CreateSubscriptionOrderResult =
  | { success: true; order: CreateSubscriptionOrderResponseDto }
  | { success: false; error: string };

export async function createSubscriptionOrderAction(
  tier: SubscriptionTier,
  months: number,
  agentProUnits?: number,
): Promise<CreateSubscriptionOrderResult> {
  const session = await auth();
  if (!session || !isAccessTokenValid(session.accessToken)) {
    return { success: false, error: "You must be logged in." };
  }

  try {
    const order = await createSubscriptionOrder(session.accessToken, tier, months, agentProUnits);
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start checkout" };
  }
}

export type CreateContactRevealCreditsOrderResult =
  | { success: true; order: CreateContactRevealCreditsOrderResponseDto }
  | { success: false; error: string };

export async function createContactRevealCreditsOrderAction(
  discountCode?: string,
): Promise<CreateContactRevealCreditsOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createContactRevealCreditsOrder(session.accessToken, discountCode);
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start checkout" };
  }
}
