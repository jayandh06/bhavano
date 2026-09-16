"use server";

import type {
  BoostPricingPreviewDto,
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateInstantAlertsOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
  ListingCategory,
  SubscriptionTier,
} from "@bhavano/types";
import type { BoostDurationDays, BoostPriceSettings } from "@bhavano/types/boostPricing";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import { auth } from "@/auth";
import {
  createBoostOrder,
  createContactRevealCreditsOrder,
  createInstantAlertsOrder,
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

/** Same reasoning as fetchBoostPricingAction — called from InstantAlertsProvider when its
 * confirmation modal actually opens. */
export async function fetchInstantAlertsPricingAction(): Promise<InstantAlertsPriceSettings> {
  const { instantAlerts } = await fetchPlanPricing();
  return instantAlerts;
}

export type CreateBoostOrderResult = { success: true; order: CreateBoostOrderResponseDto } | { success: false; error: string };

export async function createBoostOrderAction(
  listingId: string,
  boostDays: BoostDurationDays,
  discountCode?: string,
  includeInstantAlerts?: boolean,
): Promise<CreateBoostOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createBoostOrder(session.accessToken, listingId, boostDays, discountCode, includeInstantAlerts);
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start checkout" };
  }
}

// Temporary September promo — auto-applied on the post-ad success screen's Boost/Instant Alerts
// picker rather than typed in, so the discounted price is just what the screen shows. Purely a
// display/checkout convenience: the actual discount only ever takes effect if this code exists,
// is active, and hasn't expired in the DiscountCode table (managed from the admin discount-codes
// screen) — nothing here grants a discount on its own.
const SEPTEMBER_PROMO_CODE = "BHAVANO-SEP";

export type PreviewBoostPricingResult =
  | { success: true; pricing: BoostPricingPreviewDto }
  | { success: false; error: string };

export async function previewBoostPricingAction(category: ListingCategory): Promise<PreviewBoostPricingResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const pricing = await previewBoostPricing(session.accessToken, category, SEPTEMBER_PROMO_CODE);
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
): Promise<CreateBoostOrderResult> {
  return createBoostOrderAction(listingId, boostDays, SEPTEMBER_PROMO_CODE, includeInstantAlerts);
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

export type CreateInstantAlertsOrderResult =
  | { success: true; order: CreateInstantAlertsOrderResponseDto }
  | { success: false; error: string };

export async function createInstantAlertsOrderAction(
  listingId: string,
  discountCode?: string,
): Promise<CreateInstantAlertsOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createInstantAlertsOrder(session.accessToken, listingId, discountCode);
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
