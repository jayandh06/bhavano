"use server";

import type {
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateSubscriptionOrderResponseDto,
  SubscriptionTier,
} from "@bhavano/types";
import type { BoostDurationDays, BoostPriceSettings } from "@bhavano/types/boostPricing";
import { auth } from "@/auth";
import { createBoostOrder, createContactRevealCreditsOrder, createSubscriptionOrder, fetchPlanPricing } from "@/lib/bff";
import { isAccessTokenValid } from "@/lib/session";

/** Called from BoostProvider (a client component) when the boost picker actually opens — not
 * from the root layout, which would otherwise put a BFF round-trip on the critical path of every
 * single page view for a modal most visitors never open. See
 * docs/plans/admin-manage-plans-pricing.md. */
export async function fetchBoostPricingAction(): Promise<BoostPriceSettings> {
  const { boost } = await fetchPlanPricing();
  return boost;
}

export type CreateBoostOrderResult = { success: true; order: CreateBoostOrderResponseDto } | { success: false; error: string };

export async function createBoostOrderAction(listingId: string, boostDays: BoostDurationDays): Promise<CreateBoostOrderResult> {
  const session = await auth();
  if (!session?.accessToken) return { success: false, error: "You must be logged in." };

  try {
    const order = await createBoostOrder(session.accessToken, listingId, boostDays);
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start checkout" };
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
