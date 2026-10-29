"use server";

import { revalidatePath } from "next/cache";
import type { LoginSettingsDto, MoveToMobileSendResultDto } from "@bhavano/types/loginSettings";
import type { OwnerAlertSettingsDto } from "@bhavano/types/ownerAlerts";
import type { BoostPriceSettings } from "@bhavano/types/boostPricing";
import type { AppVersionSettingsDto } from "@bhavano/types/appVersion";
import type { SubscriptionPlanSettings } from "@bhavano/types/subscriptionPricing";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import type {
  Area,
  AdminUpdateListingInput,
  AdminUpdateSavedSearchInput,
  ContactRevealSettingsDto,
  LoginNudgeSettingsDto,
  RequirementStatus,
  PostedConfirmationSettingsDto,
  ReminderSettingsDto,
  SavedSearchSettingsDto,
  ListingDetailDto,
  ListingStatus,
  MessageDto,
  RateLimitSettingsDto,
  SendPostedNotificationResponseDto,
  SessionTrailDto,
  UserLoginHistoryPage,
} from "@bhavano/types";
import type { NotificationLogEntryDto } from "@bhavano/types/notificationLog";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  approveListing,
  deleteListing,
  fetchListingById,
  fetchAnyConversationMessages,
  fetchListingConversationMessages,
  fetchNotificationDayDetail,
  fetchSessionTrail,
  fetchThread,
  fetchUserLoginHistory,
  fetchAreas,
  flagListing,
  forcePublishListing,
  revokeBoost,
  rotateListingPhoto,
  sendMessage,
  sendPostedNotification,
  sendBoostPromotion,
  sendBoostMessage,
  setCoverPhoto,
  setListingStatus,
  setReviewed,
  updateBoostPricingSettings,
  updateUserSavedSearch,
  deleteUserSavedSearch,
  updateContactRevealSettings,
  updateLoginNudgeSettings,
  updateAppVersionSettings,
  updateRequirement,
  updatePostedConfirmationSettings,
  sendMoveToMobile,
  updateLoginSettings,
  updateOwnerAlertSettings,
  updateReminderSettings,
  updateSavedSearchSettings,
  updateInstantAlertsPricingSettings,
  updatePlatformFeeSettings,
  updateListingAsAdmin,
  updateRateLimitSettings,
  updateSubscriptionPlanSettings,
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

/** Waives publish checkout — makes a `pending_checkout` ad buyer-visible without Razorpay. */
export async function forcePublishListingAction(listingId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await forcePublishListing(accessToken, listingId);
    revalidatePath("/");
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to publish listing",
    };
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

export async function updateListingAction(
  listingId: string,
  input: AdminUpdateListingInput,
): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateListingAsAdmin(accessToken, listingId, input);
    revalidatePath("/");
    revalidatePath(`/listings/${listingId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update listing" };
  }
}

/** Backs the listings dashboard's bulk "Send notification" action — a deliberate resend for
 * whichever selected listings never got the creation-time acknowledgement, see
 * AdminService.sendPostedNotification's own doc comment for the already-sent gate. */
export async function sendPostedNotificationAction(
  listingIds: string[],
): Promise<SendPostedNotificationResponseDto | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await sendPostedNotification(accessToken, { listingIds });
    revalidatePath("/");
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send notification" };
  }
}

/** Backs the listings dashboard's bulk "Send boost promo" action. Marketing, not a resend of
 * something owed — AdminService.sendBoostPromotion holds the cooldown and the skip rules. */
export async function sendBoostPromotionAction(
  listingIds: string[],
): Promise<SendPostedNotificationResponseDto | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await sendBoostPromotion(accessToken, { listingIds });
    revalidatePath("/");
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send promotion" };
  }
}

/** Backs the listings dashboard's bulk "Send boost message" action — the in-app counterpart of
 * the promo above. Delivered to the owner's inbox as "Bhavano Admin"; the acting admin's name is
 * never sent anywhere. */
export async function sendBoostMessageAction(
  listingIds: string[],
): Promise<SendPostedNotificationResponseDto | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await sendBoostMessage(accessToken, { listingIds });
    revalidatePath("/");
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send message" };
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

export async function updatePostedConfirmationSettingsAction(input: PostedConfirmationSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updatePostedConfirmationSettings(accessToken, input);
    revalidatePath("/settings/posted-confirmation");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update the setting" };
  }
}

export async function sendMoveToMobileAction(
  deadline?: string,
): Promise<{ success: true; result: MoveToMobileSendResultDto } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const result = await sendMoveToMobile(accessToken, deadline);
    revalidatePath("/settings/login");
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to send the messages" };
  }
}

export async function updateOwnerAlertSettingsAction(input: OwnerAlertSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateOwnerAlertSettings(accessToken, input);
    revalidatePath("/settings/owner-alerts");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update the owner alert settings" };
  }
}

export async function updateLoginSettingsAction(input: LoginSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateLoginSettings(accessToken, input);
    revalidatePath("/settings/login");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update the login methods" };
  }
}

export async function updateReminderSettingsAction(input: ReminderSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateReminderSettings(accessToken, input);
    revalidatePath("/settings/reminders");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update the reminders" };
  }
}

export async function updateSavedSearchSettingsAction(input: SavedSearchSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateSavedSearchSettings(accessToken, input);
    revalidatePath("/settings/alerts");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update alert settings" };
  }
}

export async function updateRequirementAction(
  id: string,
  input: { status?: RequirementStatus; adminNote?: string },
): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateRequirement(accessToken, id, input);
    revalidatePath("/requirements");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update requirement" };
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

export async function updateAppVersionSettingsAction(input: AppVersionSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateAppVersionSettings(accessToken, input);
    revalidatePath("/settings/app-version");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update app version settings" };
  }
}

export async function updateLoginNudgeSettingsAction(input: LoginNudgeSettingsDto): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateLoginNudgeSettings(accessToken, input);
    revalidatePath("/settings/login-nudge");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update login prompt settings" };
  }
}

export async function updateBoostPricingAction(input: BoostPriceSettings): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateBoostPricingSettings(accessToken, input);
    revalidatePath("/settings/plans");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update Feature pricing" };
  }
}

export async function updateSubscriptionPlanAction(input: SubscriptionPlanSettings): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateSubscriptionPlanSettings(accessToken, input);
    revalidatePath("/settings/plans");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update subscription plans" };
  }
}

export async function updateInstantAlertsPricingAction(input: InstantAlertsPriceSettings): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateInstantAlertsPricingSettings(accessToken, input);
    revalidatePath("/settings/plans");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update Instant Alerts pricing" };
  }
}

export async function updatePlatformFeeAction(input: PlatformFeeSettings): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updatePlatformFeeSettings(accessToken, input);
    revalidatePath("/settings/plans");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update platform fee" };
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
    revalidatePath("/subscriptions");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to revoke Feature" };
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

/** The Messages screen's row-expand: any conversation's thread by id (enquiry or staff thread). */
export async function fetchAnyConversationMessagesAction(
  conversationId: string,
): Promise<{ success: true; messages: MessageDto[] } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const messages = await fetchAnyConversationMessages(accessToken, conversationId);
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load messages" };
  }
}

/** Same shape as fetchConversationMessagesAction — PageVisitsTable's row-expand fetches a
 * session's full page-view trail on demand instead of navigating to the standalone
 * /page-visits/[sessionId] page. That route still exists (direct links/bookmarks still work),
 * it's just no longer the primary way to see this from the table. */
export async function fetchSessionTrailAction(
  sessionId: string,
): Promise<{ success: true; trail: SessionTrailDto } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const trail = await fetchSessionTrail(accessToken, sessionId);
    return { success: true, trail };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load session trail" };
  }
}

/** Same shape again — the notification-log page's row-expand fetches one day's actual sends only
 * when that day is clicked, mirroring PageVisitsTable's fetch-once-per-row cache. */
export async function fetchNotificationDayDetailAction(
  date: string,
  filters: { channel?: string; kind?: string; userId?: string } = {},
): Promise<{ success: true; entries: NotificationLogEntryDto[] } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const entries = await fetchNotificationDayDetail(accessToken, date, filters);
    return { success: true, entries };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load that day's notifications" };
  }
}

/** Same shape again — AdminListingsTable's row-expand fetches a listing's full detail (photos,
 * description, attributes, renewal history, contact info) on demand via the existing
 * GET /listings/:id (findOne), confirmed to have no side effects worth avoiding here (no
 * view-count increment — just reads plus a ContactRevealService lookup), rather than the admin
 * queue's own list query carrying all of that for every row on every page load. */
export async function fetchListingDetailAction(
  listingId: string,
): Promise<{ success: true; listing: ListingDetailDto } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const listing = await fetchListingById(accessToken, listingId);
    return { success: true, listing };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load listing detail" };
  }
}

/** Same shape again — RecentLoginsTable's row-expand fetches a user's full login history on
 * demand (every LoginEvent, not just the one most-recent login UserLoginSummaryDto carries). */
export async function fetchUserLoginHistoryAction(
  userId: string,
): Promise<{ success: true; history: UserLoginHistoryPage } | { success: false; error: string }> {
  const { accessToken } = await requireAdmin();
  try {
    const history = await fetchUserLoginHistory(accessToken, userId);
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load login history" };
  }
}

export async function fetchSavedSearchAreasAction(
  cityId: string,
): Promise<{ success: true; areas: Area[] } | { success: false; error: string }> {
  await requireAdmin();
  try {
    return { success: true, areas: await fetchAreas(cityId, undefined, true) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load areas" };
  }
}

export async function updateUserSavedSearchAction(
  userId: string,
  searchId: string,
  input: AdminUpdateSavedSearchInput,
): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await updateUserSavedSearch(accessToken, userId, searchId, input);
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update saved search" };
  }
}

export async function deleteUserSavedSearchAction(userId: string, searchId: string): Promise<ActionResult> {
  const { accessToken } = await requireAdmin();
  try {
    await deleteUserSavedSearch(accessToken, userId, searchId);
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete saved search" };
  }
}
