"use server";

import type { CreateBoostOrderResponseDto } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { auth } from "@/auth";
import { createBoostOrder } from "@/lib/bff";

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
