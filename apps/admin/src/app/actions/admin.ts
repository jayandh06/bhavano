"use server";

import { revalidatePath } from "next/cache";
import type { RateLimitSettingsDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { approveListing, fetchThread, flagListing, revokeBoost, sendMessage, setReviewed, updateRateLimitSettings } from "@/lib/bff";

export type ActionResult = { success: true } | { success: false; error: string };

export async function setReviewedAction(listingId: string, adminReviewed: boolean): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await setReviewed(accessToken, listingId, adminReviewed);
    revalidatePath("/");
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update" };
  }
}

export async function flagListingAction(listingId: string, message: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await flagListing(accessToken, listingId, { message });
    revalidatePath("/");
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to flag listing" };
  }
}

export async function approveListingAction(listingId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await approveListing(accessToken, listingId);
    revalidatePath("/");
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to approve listing" };
  }
}

export async function sendThreadMessageAction(listingId: string, body: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    const thread = await fetchThread(accessToken, listingId);
    await sendMessage(accessToken, thread.id, body);
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send message" };
  }
}

export async function updateRateLimitsAction(input: RateLimitSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateRateLimitSettings(accessToken, input);
    revalidatePath("/settings/rate-limits");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update rate limits" };
  }
}

export async function revokeBoostAction(listingId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await revokeBoost(accessToken, listingId);
    revalidatePath("/boosts");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to revoke boost" };
  }
}
