"use server";

import { revalidatePath } from "next/cache";
import type { ContactRevealSettingsDto, ListingStatus, MessageDto, RateLimitSettingsDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  approveListing,
  deleteListing,
  fetchListingConversationMessages,
  fetchThread,
  flagListing,
  revokeBoost,
  rotateListingPhoto,
  sendMessage,
  setCoverPhoto,
  setListingStatus,
  setReviewed,
  updateContactRevealSettings,
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

/** Permanent hard-delete — the caller is expected to navigate away from `/listings/[id]`, which
 * no longer exists. Revalidates the queue so the row is gone there too. */
export async function deleteListingAction(listingId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await deleteListing(accessToken, listingId);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete listing" };
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

export async function setListingStatusAction(listingId: string, status: ListingStatus): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await setListingStatus(accessToken, listingId, status);
    revalidatePath("/");
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update status" };
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

export async function updateContactRevealSettingsAction(input: ContactRevealSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateContactRevealSettings(accessToken, input);
    revalidatePath("/settings/contact-reveal");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update contact-reveal settings" };
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

export type SetCoverPhotoResult = ActionResult;

/** Makes a photo the cover (shown first on browse cards and atop the detail gallery) — see
 * docs/plans/listing-photo-cover-and-owner-controls.md. Unlike rotate, this is instant: no
 * reprocessing, so revalidating right away shows the new order correctly. */
export async function setCoverPhotoAction(listingId: string, photoNo: number): Promise<SetCoverPhotoResult> {
  const { accessToken } = await requireAdmin();
  try {
    await setCoverPhoto(accessToken, listingId, photoNo);
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to set cover photo" };
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

/** The only path from ConversationsTable's row-click (a client component) to the new admin
 * conversation-thread route — `apps/admin/src/lib/bff.ts` is server-only and the BFF access
 * token lives only in the server-side NextAuth session, so a client component cannot fetch the
 * BFF directly. */
export async function fetchConversationMessagesAction(
  listingId: string,
  conversationId: string,
): Promise<{ success: true; messages: MessageDto[] } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const messages = await fetchListingConversationMessages(accessToken, listingId, conversationId);
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load messages" };
  }
}
