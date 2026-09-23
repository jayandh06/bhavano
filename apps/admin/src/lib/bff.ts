import "server-only";
import type { BoostPriceSettings } from "@bhavano/types/boostPricing";
import type { SubscriptionPlanSettings } from "@bhavano/types/subscriptionPricing";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import type {
  AdminConversationsPage,
  AdminDiscountCodesPage,
  AdminListingsPage,
  AdminPaymentsPage,
  AdminRequirementsPage,
  AdminUpdateListingInput,
  AdminUsersPage,
  Area,
  AuthSession,
  City,
  ClaimSource,
  ClientErrorInput,
  ContactRevealSettingsDto,
  ConversationSummaryDto,
  CreateDiscountCodeInput,
  DeviceType,
  DiscountCodeDto,
  FlagListingInput,
  ListingCategory,
  ListingDetailDto,
  ListingEditLogPage,
  ListingEngagementPage,
  ListingOwnerDto,
  ListingStatus,
  LoginMethod,
  MessageDto,
  PageVisitsPage,
  PaymentPurpose,
  PaymentStatus,
  ModerationState,
  RateLimitSettingsDto,
  RequirementStatus,
  SavedSearchSettingsDto,
  SearchDemandPage,
  SendPostedNotificationInput,
  SendPostedNotificationResponseDto,
  SendWelcomeInput,
  SendWelcomeResponseDto,
  SessionTrailDto,
  TransactionType,
  UserActivityDto,
  UserLoginHistoryPage,
  UserLoginSummariesPage,
  UserRole,
  OutreachContactsPage,
  OutreachCampaignsPage,
  OutreachCampaignDto,
  CampaignPreviewDto,
  CampaignSendsPage,
  ClaimVerificationSendDto,
  PlacesFetchLogPage,
  CreateOutreachCampaignInput,
  UpdateOutreachCampaignInput,
  ImportOutreachContactsInput,
  ImportOutreachContactsResult,
} from "@bhavano/types";

/** Mirrors the BFF's ADMIN_LISTING_SORT_VALUES (apps/bff/src/admin/dto/list-admin-listings.dto.ts)
 * — one asc/desc pair per sortable column on the dashboard's listings table. */
export type AdminListingSortField =
  | "createdAt"
  | "updatedAt"
  | "status"
  | "title"
  | "category"
  | "transactionType"
  | "moderationState"
  | "source"
  | "claimSource"
  | "price"
  | "viewCount"
  | "likeCount"
  | "messageCount"
  | "expiresAt";

export type AdminListingSort = `${AdminListingSortField}_asc` | `${AdminListingSortField}_desc`;

/** Mirrors the BFF's LOGIN_SORT_VALUES (apps/bff/src/admin/dto/list-logins.dto.ts) — one row per
 * user now, not per LoginEvent, so the sortable columns are the per-user summary fields. */
export type AdminLoginSortField = "lastLoginAt" | "firstLoginAt" | "userName";
export type AdminLoginSort = `${AdminLoginSortField}_asc` | `${AdminLoginSortField}_desc`;

/** Mirrors the BFF's PAGE_VISIT_SORT_VALUES (apps/bff/src/admin/dto/list-page-visits.dto.ts) —
 * one asc/desc pair per sortable column, driving the page-visits table's header sort toggles.
 * No `pageViewCount` pair: see that constant's own comment for why it can't be ordered on. */
export type AdminPageVisitSortField =
  | "createdAt"
  | "user"
  | "city"
  | "deviceType"
  | "source"
  | "medium"
  | "campaign"
  | "campaignId"
  | "adGroupId"
  | "landingPath"
  | "ip"
  | "region"
  | "country";

export type AdminPageVisitSort = `${AdminPageVisitSortField}_asc` | `${AdminPageVisitSortField}_desc`;

/** Mirrors the BFF's PAGE_VISIT_IDENTITY_VALUES (apps/bff/src/admin/dto/list-page-visits.dto.ts). */
export type AdminPageVisitIdentity = "any" | "anonymous" | "logged_in";

/** Mirrors the BFF's ADMIN_PAYMENT_SORT_VALUES (apps/bff/src/admin/dto/list-payments.dto.ts) —
 * one asc/desc pair per sortable column. No `expiresAt` pair: see AdminPaymentDto's own doc
 * comment for why it can't be ordered on. */
export type AdminPaymentSortField = "createdAt" | "paidAt" | "amount" | "status" | "purpose" | "user" | "listing";

export type AdminPaymentSort = `${AdminPaymentSortField}_asc` | `${AdminPaymentSortField}_desc`;

/** Mirrors the BFF's PAGE_VISIT_TRAFFIC_VALUES. "humans" means *classified* as not-a-bot —
 * see that constant's own comment on why unclassified history can't be counted as human. */
export type AdminPageVisitTraffic = "any" | "humans" | "js_confirmed" | "bots" | "unclassified";

/** Mirrors the BFF's USER_SORT_VALUES (apps/bff/src/admin/dto/list-users.dto.ts). */
export type AdminUserSort = "createdAt_desc" | "createdAt_asc" | "name_asc";

const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

async function bffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // NestJS error responses are JSON ({ message, statusCode, error }) — surface the plain
    // message when present instead of the raw JSON blob.
    const parsedMessage = (() => {
      try {
        const parsed = JSON.parse(body) as { message?: string | string[] };
        return Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch {
        return undefined;
      }
    })();
    throw new Error(parsedMessage ?? `BFF request failed (${res.status} ${path}): ${body}`);
  }
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

function authedBffFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  return bffFetch<T>(path, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers } });
}

export function sendOtp(phone: string): Promise<{ success: true }> {
  return bffFetch("/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
}

export function verifyOtp(phone: string, code: string): Promise<AuthSession> {
  return bffFetch("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
}

/** Best-effort — a failed error *report* must never itself surface as a second error. See
 * docs/plans/client-error-reporting-loki-grafana.md. */
export async function reportClientError(input: ClientErrorInput): Promise<void> {
  try {
    await bffFetch<null>("/client-errors", { method: "POST", body: JSON.stringify(input) });
  } catch {
    // Nothing to do — there's no second place to report a failed error report to.
  }
}

export function loginWithGoogle(idToken: string): Promise<AuthSession> {
  return bffFetch("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) });
}

/** No server-side session to end — this only exists so the BFF gets a logout signal to log
 * (see docs/plans/bff-loki-grafana-logging.md), since NextAuth's own signOut() never calls the
 * BFF on its own. */
export function logout(accessToken: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/auth/logout", { method: "POST" });
}

export interface AdminListingsQuery {
  search?: string;
  moderationState?: ModerationState;
  adminReviewed?: boolean;
  category?: ListingCategory;
  transactionType?: TransactionType;
  status?: ListingStatus;
  cityId?: string;
  areaId?: string;
  userId?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sort?: AdminListingSort;
  offset?: number;
  limit?: number;
}

export function fetchAdminListings(accessToken: string, query: AdminListingsQuery): Promise<AdminListingsPage> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.moderationState) params.set("moderationState", query.moderationState);
  if (query.adminReviewed !== undefined) params.set("adminReviewed", String(query.adminReviewed));
  if (query.category) params.set("category", query.category);
  if (query.transactionType) params.set("transactionType", query.transactionType);
  if (query.status) params.set("status", query.status);
  if (query.cityId) params.set("cityId", query.cityId);
  if (query.areaId) params.set("areaId", query.areaId);
  if (query.userId) params.set("userId", query.userId);
  if (query.createdFrom) params.set("createdFrom", query.createdFrom);
  if (query.createdTo) params.set("createdTo", query.createdTo);
  if (query.updatedFrom) params.set("updatedFrom", query.updatedFrom);
  if (query.updatedTo) params.set("updatedTo", query.updatedTo);
  if (query.sort) params.set("sort", query.sort);
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/listings?${params.toString()}`, { cache: "no-store" });
}

export function fetchCities(q?: string, all?: boolean): Promise<City[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<City[]>(`/locations/cities?${params.toString()}`, { cache: "no-store" });
}

export function fetchAreas(cityId: string, q?: string, all?: boolean): Promise<Area[]> {
  const params = new URLSearchParams({ cityId });
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<Area[]>(`/locations/areas?${params.toString()}`, { cache: "no-store" });
}

export function searchUsers(accessToken: string, q: string, limit = 10): Promise<ListingOwnerDto[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return authedBffFetch(accessToken, `/admin/users/search?${params.toString()}`, { cache: "no-store" });
}

export function fetchListingById(accessToken: string, id: string): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/listings/${id}`, { cache: "no-store" });
}

export function setReviewed(accessToken: string, id: string, adminReviewed: boolean): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/admin/listings/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ adminReviewed }),
  });
}

export function flagListing(accessToken: string, id: string, input: FlagListingInput): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/admin/listings/${id}/flag`, { method: "POST", body: JSON.stringify(input) });
}

export function approveListing(accessToken: string, id: string): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/admin/listings/${id}/approve`, { method: "POST" });
}

/** Permanent hard-delete with full R2 + DB cleanup — see BFF ListingsService.deleteCompletely. */
export function deleteListing(accessToken: string, id: string): Promise<void> {
  return authedBffFetch(accessToken, `/admin/listings/${id}`, { method: "DELETE" });
}

/** Deletes every listing the user owns (with asset cleanup), then anonymises the account — see
 * BFF AdminService.deleteUser. Rejected for admin accounts. */
export function deleteUser(accessToken: string, id: string): Promise<void> {
  return authedBffFetch(accessToken, `/admin/users/${id}`, { method: "DELETE" });
}

export function setListingStatus(accessToken: string, id: string, status: ListingStatus): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/admin/listings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Admin override of a listing's own content — the fields the owner's own edit form sends, plus
 * admin-only category/transactionType/cityId/areaId/areaName/lat/lng — via the admin-only
 * PATCH /admin/listings/:id (see ListingsService.updateAsAdmin). Only the fields actually being
 * changed need to be included — same partial-update semantics as the owner-facing update. See
 * docs/plans/admin-edit-location-and-category.md. */
export function updateListingAsAdmin(
  accessToken: string,
  id: string,
  input: AdminUpdateListingInput,
): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/admin/listings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function rotateListingPhoto(
  accessToken: string,
  id: string,
  photoNo: number,
  turns: number,
): Promise<{ rotation: number }> {
  return authedBffFetch(accessToken, `/admin/listings/${id}/photos/${photoNo}/rotate`, {
    method: "POST",
    body: JSON.stringify({ turns }),
  });
}

export function setCoverPhoto(
  accessToken: string,
  id: string,
  photoNo: number,
): Promise<{ displayOrder: number }> {
  return authedBffFetch(accessToken, `/admin/listings/${id}/photos/${photoNo}/set-cover`, { method: "POST" });
}

export function fetchThread(accessToken: string, listingId: string): Promise<{ id: string }> {
  return authedBffFetch(accessToken, `/admin/listings/${listingId}/thread`, { cache: "no-store" });
}

export function fetchConversations(accessToken: string): Promise<ConversationSummaryDto[]> {
  return authedBffFetch(accessToken, "/conversations", { cache: "no-store" });
}

export function fetchMessages(accessToken: string, conversationId: string): Promise<MessageDto[]> {
  return authedBffFetch(accessToken, `/conversations/${conversationId}/messages`, { cache: "no-store" });
}

export function sendMessage(accessToken: string, conversationId: string, body: string): Promise<MessageDto> {
  return authedBffFetch(accessToken, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function fetchListingOwner(accessToken: string, listingId: string): Promise<ListingOwnerDto | null> {
  return authedBffFetch(accessToken, `/admin/listings/${listingId}/owner`, { cache: "no-store" });
}

export function fetchListingEngagement(
  accessToken: string,
  listingId: string,
  query: { offset?: number; limit?: number } = {},
): Promise<ListingEngagementPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/listings/${listingId}/engagement?${params.toString()}`, {
    cache: "no-store",
  });
}

export function fetchListingEditHistory(
  accessToken: string,
  listingId: string,
  query: { offset?: number; limit?: number } = {},
): Promise<ListingEditLogPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/listings/${listingId}/edit-history?${params.toString()}`, {
    cache: "no-store",
  });
}

export function fetchListingConversations(
  accessToken: string,
  listingId: string,
  query: { offset?: number; limit?: number } = {},
): Promise<AdminConversationsPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/listings/${listingId}/conversations?${params.toString()}`, {
    cache: "no-store",
  });
}

export function fetchListingConversationMessages(
  accessToken: string,
  listingId: string,
  conversationId: string,
): Promise<MessageDto[]> {
  return authedBffFetch(
    accessToken,
    `/admin/listings/${listingId}/conversations/${conversationId}/messages`,
    { cache: "no-store" },
  );
}

export interface RecentLoginsQuery {
  offset?: number;
  from?: string;
  to?: string;
  userId?: string;
  search?: string;
  method?: LoginMethod;
  isNewUser?: boolean;
  hasPostedAd?: boolean;
  sort?: AdminLoginSort;
  limit?: number;
}

export function fetchRecentLogins(accessToken: string, query: RecentLoginsQuery = {}): Promise<UserLoginSummariesPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.userId) params.set("userId", query.userId);
  if (query.search) params.set("search", query.search);
  if (query.method) params.set("method", query.method);
  if (query.isNewUser !== undefined) params.set("isNewUser", String(query.isNewUser));
  if (query.hasPostedAd !== undefined) params.set("hasPostedAd", String(query.hasPostedAd));
  if (query.sort) params.set("sort", query.sort);
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/logins?${params.toString()}`, { cache: "no-store" });
}

export function fetchUserLoginHistory(
  accessToken: string,
  userId: string,
  query: { offset?: number; limit?: number } = {},
): Promise<UserLoginHistoryPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/users/${userId}/login-history?${params.toString()}`, {
    cache: "no-store",
  });
}

export interface PageVisitsQuery {
  offset?: number;
  /** Full ISO instants — the page turns its IST date pickers into `+05:30` day bounds. */
  from?: string;
  to?: string;
  userId?: string;
  /** `anonymous`/`logged_in` are mutually exclusive with `userId` in the admin page's UI. */
  identity?: AdminPageVisitIdentity;
  traffic?: AdminPageVisitTraffic;
  deviceType?: DeviceType;
  source?: string;
  medium?: string;
  ip?: string;
  landingPath?: string;
  city?: string;
  region?: string;
  country?: string;
  sort?: AdminPageVisitSort;
  limit?: number;
}

export function fetchPageVisits(accessToken: string, query: PageVisitsQuery = {}): Promise<PageVisitsPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return authedBffFetch(accessToken, `/admin/page-visits?${params.toString()}`, { cache: "no-store" });
}

export function fetchSessionTrail(accessToken: string, sessionId: string): Promise<SessionTrailDto> {
  return authedBffFetch(accessToken, `/admin/page-visits/${encodeURIComponent(sessionId)}/trail`, { cache: "no-store" });
}

export interface PaymentsQuery {
  offset?: number;
  /** Full ISO instants — the page turns its IST date pickers into `+05:30` day bounds. */
  from?: string;
  to?: string;
  userId?: string;
  purpose?: PaymentPurpose;
  status?: PaymentStatus;
  listingTitle?: string;
  sort?: AdminPaymentSort;
  limit?: number;
}

export function fetchPayments(accessToken: string, query: PaymentsQuery = {}): Promise<AdminPaymentsPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return authedBffFetch(accessToken, `/admin/payments?${params.toString()}`, { cache: "no-store" });
}

export function fetchUserActivity(accessToken: string, userId: string): Promise<UserActivityDto> {
  return authedBffFetch(accessToken, `/admin/users/${userId}/activity`, { cache: "no-store" });
}

export interface AdminUsersQuery {
  offset?: number;
  from?: string;
  to?: string;
  q?: string;
  role?: UserRole;
  welcomed?: "yes" | "no";
  sort?: AdminUserSort;
  limit?: number;
}

export function fetchUsers(accessToken: string, query: AdminUsersQuery = {}): Promise<AdminUsersPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return authedBffFetch(accessToken, `/admin/users?${params.toString()}`, { cache: "no-store" });
}

export function sendWelcome(accessToken: string, input: SendWelcomeInput): Promise<SendWelcomeResponseDto> {
  return authedBffFetch(accessToken, "/admin/users/welcome", { method: "POST", body: JSON.stringify(input) });
}

/** Admin-triggered (re)send of the "your ad is live" acknowledgement for listings whose
 * creation-time send never landed — see AdminService.sendPostedNotification. */
export function sendPostedNotification(
  accessToken: string,
  input: SendPostedNotificationInput,
): Promise<SendPostedNotificationResponseDto> {
  return authedBffFetch(accessToken, "/admin/listings/notify-posted", { method: "POST", body: JSON.stringify(input) });
}

/** Promotes Boost and Instant Alerts to the owners of the selected live ads — see
 * AdminService.sendBoostPromotion for the cooldown and skip rules. */
export function sendBoostPromotion(
  accessToken: string,
  input: SendPostedNotificationInput,
): Promise<SendPostedNotificationResponseDto> {
  return authedBffFetch(accessToken, "/admin/listings/notify-boost-promotion", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchRateLimitSettings(accessToken: string): Promise<RateLimitSettingsDto> {
  return authedBffFetch(accessToken, "/admin/rate-limits", { cache: "no-store" });
}

export function updateRateLimitSettings(accessToken: string, input: RateLimitSettingsDto): Promise<RateLimitSettingsDto> {
  return authedBffFetch(accessToken, "/admin/rate-limits", { method: "PATCH", body: JSON.stringify(input) });
}

export function revokeBoost(accessToken: string, listingId: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, `/admin/listings/${listingId}/revoke-boost`, { method: "POST" });
}

export function fetchSearchDemand(
  accessToken: string,
  query: { days?: number; limit?: number } = {},
): Promise<SearchDemandPage> {
  const params = new URLSearchParams();
  if (query.days !== undefined) params.set("days", String(query.days));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/search-demand?${params.toString()}`, { cache: "no-store" });
}

export function fetchSavedSearchSettings(accessToken: string): Promise<SavedSearchSettingsDto> {
  return authedBffFetch(accessToken, "/admin/saved-search-settings", { cache: "no-store" });
}

export function updateSavedSearchSettings(
  accessToken: string,
  input: SavedSearchSettingsDto,
): Promise<SavedSearchSettingsDto> {
  return authedBffFetch(accessToken, "/admin/saved-search-settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchRequirements(
  accessToken: string,
  query: { status?: RequirementStatus; offset?: number; limit?: number } = {},
): Promise<AdminRequirementsPage> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/requirements?${params.toString()}`, { cache: "no-store" });
}

export function updateRequirement(
  accessToken: string,
  id: string,
  input: { status?: RequirementStatus; adminNote?: string },
): Promise<void> {
  return authedBffFetch(accessToken, `/admin/requirements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchContactRevealSettings(accessToken: string): Promise<ContactRevealSettingsDto> {
  return authedBffFetch(accessToken, "/admin/contact-reveal-settings", { cache: "no-store" });
}

export function updateContactRevealSettings(
  accessToken: string,
  input: ContactRevealSettingsDto,
): Promise<ContactRevealSettingsDto> {
  return authedBffFetch(accessToken, "/admin/contact-reveal-settings", { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchBoostPricingSettings(accessToken: string): Promise<BoostPriceSettings> {
  return authedBffFetch(accessToken, "/admin/boost-pricing", { cache: "no-store" });
}

export function updateBoostPricingSettings(
  accessToken: string,
  input: BoostPriceSettings,
): Promise<BoostPriceSettings> {
  return authedBffFetch(accessToken, "/admin/boost-pricing", { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchSubscriptionPlanSettings(accessToken: string): Promise<SubscriptionPlanSettings> {
  return authedBffFetch(accessToken, "/admin/subscription-plans", { cache: "no-store" });
}

export function updateSubscriptionPlanSettings(
  accessToken: string,
  input: SubscriptionPlanSettings,
): Promise<SubscriptionPlanSettings> {
  return authedBffFetch(accessToken, "/admin/subscription-plans", { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchInstantAlertsPricingSettings(accessToken: string): Promise<InstantAlertsPriceSettings> {
  return authedBffFetch(accessToken, "/admin/instant-alerts-pricing", { cache: "no-store" });
}

export function updateInstantAlertsPricingSettings(
  accessToken: string,
  input: InstantAlertsPriceSettings,
): Promise<InstantAlertsPriceSettings> {
  return authedBffFetch(accessToken, "/admin/instant-alerts-pricing", { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchPlatformFeeSettings(accessToken: string): Promise<import("@bhavano/types/platformFeePricing").PlatformFeeSettings> {
  return authedBffFetch(accessToken, "/admin/platform-fee", { cache: "no-store" });
}

export function updatePlatformFeeSettings(
  accessToken: string,
  input: import("@bhavano/types/platformFeePricing").PlatformFeeSettings,
): Promise<import("@bhavano/types/platformFeePricing").PlatformFeeSettings> {
  return authedBffFetch(accessToken, "/admin/platform-fee", { method: "PATCH", body: JSON.stringify(input) });
}

export interface ListDiscountCodesQuery {
  offset?: number;
  limit?: number;
}

export function fetchDiscountCodes(
  accessToken: string,
  query: ListDiscountCodesQuery = {},
): Promise<AdminDiscountCodesPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/discount-codes?${params.toString()}`, { cache: "no-store" });
}

export function createDiscountCode(accessToken: string, input: CreateDiscountCodeInput): Promise<DiscountCodeDto> {
  return authedBffFetch(accessToken, "/admin/discount-codes", { method: "POST", body: JSON.stringify(input) });
}

export function setDiscountCodeActive(accessToken: string, id: string, active: boolean): Promise<DiscountCodeDto> {
  return authedBffFetch(accessToken, `/admin/discount-codes/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
}

// --- Outreach / campaigns ---------------------------------------------------

export interface ListOutreachContactsQuery {
  offset?: number;
  limit?: number;
  search?: string;
  cityId?: string;
  areaId?: string;
  status?: string;
  businessCategory?: string;
  placesFetchLogId?: string;
  consentState?: string;
  hasListing?: string;
  notificationStatus?: string;
  sort?: string;
}

export function fetchOutreachContacts(
  accessToken: string,
  query: ListOutreachContactsQuery = {},
): Promise<OutreachContactsPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  return authedBffFetch(accessToken, `/admin/outreach/contacts?${params.toString()}`, { cache: "no-store" });
}

/** Distinct businessCategory values actually present, for the filter dropdown — see
 * OutreachService.listBusinessCategories's doc comment for why this stays derived from data
 * rather than a hardcoded list. */
export function fetchOutreachContactCategories(accessToken: string): Promise<string[]> {
  return authedBffFetch(accessToken, "/admin/outreach/contacts/categories", { cache: "no-store" });
}

export function importOutreachContacts(
  accessToken: string,
  input: ImportOutreachContactsInput,
): Promise<ImportOutreachContactsResult> {
  return authedBffFetch(accessToken, "/admin/outreach/contacts/import", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function optOutContact(accessToken: string, contactId: string, reason?: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, `/admin/outreach/contacts/${contactId}/opt-out`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function sendClaimVerification(
  accessToken: string,
  contactId: string,
): Promise<{ sent: boolean; channels: ClaimSource[]; reason?: string }> {
  return authedBffFetch(accessToken, `/admin/outreach/contacts/${contactId}/send-claim-verification`, {
    method: "POST",
  });
}

export function createListingFromContact(accessToken: string, contactId: string): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/admin/outreach/contacts/${contactId}/create-listing`, {
    method: "POST",
  });
}

export function fetchPlacesFetchLog(
  accessToken: string,
  query: { offset?: number; limit?: number; cityId?: string; businessCategory?: string } = {},
): Promise<PlacesFetchLogPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  return authedBffFetch(accessToken, `/admin/outreach/places-fetch-log?${params.toString()}`, {
    cache: "no-store",
  });
}

export function fetchCampaigns(
  accessToken: string,
  query: { offset?: number; limit?: number } = {},
): Promise<OutreachCampaignsPage> {
  const params = new URLSearchParams();
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/outreach/campaigns?${params.toString()}`, { cache: "no-store" });
}

export function fetchCampaign(accessToken: string, id: string): Promise<OutreachCampaignDto> {
  return authedBffFetch(accessToken, `/admin/outreach/campaigns/${id}`, { cache: "no-store" });
}

export function createCampaign(
  accessToken: string,
  input: CreateOutreachCampaignInput,
): Promise<OutreachCampaignDto> {
  return authedBffFetch(accessToken, "/admin/outreach/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCampaign(
  accessToken: string,
  id: string,
  input: UpdateOutreachCampaignInput,
): Promise<OutreachCampaignDto> {
  return authedBffFetch(accessToken, `/admin/outreach/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function previewCampaign(accessToken: string, id: string): Promise<CampaignPreviewDto> {
  return authedBffFetch(accessToken, `/admin/outreach/campaigns/${id}/preview`, { cache: "no-store" });
}

export function runCampaign(
  accessToken: string,
  id: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  return authedBffFetch(accessToken, `/admin/outreach/campaigns/${id}/run`, { method: "POST" });
}

export function fetchCampaignSends(
  accessToken: string,
  query: { offset?: number; limit?: number; campaignId?: string; contactId?: string } = {},
): Promise<CampaignSendsPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  return authedBffFetch(accessToken, `/admin/outreach/sends?${params.toString()}`, { cache: "no-store" });
}

export function fetchClaimVerificationSends(
  accessToken: string,
  contactId: string,
): Promise<ClaimVerificationSendDto[]> {
  return authedBffFetch(accessToken, `/admin/outreach/contacts/${contactId}/notification-log`, {
    cache: "no-store",
  });
}
