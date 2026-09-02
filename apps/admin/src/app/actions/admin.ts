"use server";

import { revalidatePath } from "next/cache";
import type { RateLimitSettingsDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  approveListing,
  fetchThread,
  flagListing,
  revokeBoost,
  rotateListingPhoto,
  sendMessage,
  setReviewed,
  updateRateLimitSettings,
} from "@/lib/bff";

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

export type RotatePhotoResult = { success: true; rotation: number } | { success: false; error: string };

/** Rotates a photo `turns` × 90° and re-triggers variant generation once — see
 * docs/plans/listing-photo-orientation.md. `turns` (1-3) is the full amount the admin decided on
 * after cycling through a local, unsaved preview client-side; this is the one and only server
 * call for that decision, not one per preview click. The rotated image itself won't be ready the
 * instant this resolves: PhotoProcessingService picks the reset jobs up on its next poll (every
 * few seconds), so the caller should wait briefly before revalidating/refetching for real. */
export async function rotatePhotoAction(listingId: string, photoNo: number, turns: number): Promise<RotatePhotoResult> {
  const { accessToken } = await requireAdmin();
  try {
    const { rotation } = await rotateListingPhoto(accessToken, listingId, photoNo, turns);
    revalidatePath(`/listings/${listingId}`);
    return { success: true, rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to rotate photo" };
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
