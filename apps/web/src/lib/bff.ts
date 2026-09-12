import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type {
  AgentStorefrontDto,
  Area,
  AuthSession,
  City,
  ContactRevealBalanceDto,
  ContactRevealSettingsDto,
  ConversationDetailDto,
  ConversationSummaryDto,
  CreateBoostOrderResponseDto,
  CreateContactRevealCreditsOrderResponseDto,
  CreateListingInput,
  CreateSavedSearchInput,
  CreateSubscriptionOrderResponseDto,
  HomeCategoryFilter,
  ListingCardDto,
  ListingCategory,
  ListingDetailDto,
  ListingMetaDto,
  ListingSitemapEntry,
  ListingsPage,
  MessageDto,
  PaymentHistoryPage,
  PopularSearchDto,
  ProfileNudgeDto,
  PropertyTypeFilter,
  RevealContactResponseDto,
  ReverseGeocodeResultDto,
  SavedSearchDto,
  SubscriptionTier,
  TransactionType,
  UpdateListingInput,
  UpdateProfileInput,
  UserProfileDto,
} from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import type { CreateSupportTicketResponse } from "@bhavano/types/support";
import type { LinkIdentifierResult } from "@bhavano/types";
import { isListingSlotCapErrorBody, ListingSlotCapError } from "@/lib/listingSlotErrors";

const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

/** Thrown when the BFF rejects a request with 401 — e.g. the accessToken embedded in the
 * NextAuth session has expired (1h TTL) even though NextAuth's own session cookie is still
 * valid. Callers on authed pages/actions should catch this and prompt re-login instead of
 * letting it crash the render. */
export class BffAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BffAuthError";
  }
}

/** Thrown when POST /listings/:id/reveal-contact returns 402 — the caller opens the
 * credit-purchase flow rather than showing this as a plain error banner. See
 * docs/plans/contact-reveal-credits.md. */
export class InsufficientContactRevealCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientContactRevealCreditsError";
  }
}

/** Thrown when POST /listings/:id/claim returns 409 — someone else already claimed it. Its own
 * type so ClaimListing.tsx can render this as informational ("already taken care of, by someone
 * else") rather than the generic "Couldn't verify this listing" failure copy, which reads as a
 * malfunction for what's actually an expected outcome. */
export class ListingAlreadyClaimedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingAlreadyClaimedError";
  }
}

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
        const parsed = JSON.parse(body) as {
          message?: string | string[] | Record<string, unknown>;
          code?: string;
          activeCount?: number;
        };
        if (res.status === 403) {
          const nested =
            parsed.message && typeof parsed.message === "object" && !Array.isArray(parsed.message)
              ? parsed.message
              : parsed;
          if (isListingSlotCapErrorBody(nested)) {
            throw new ListingSlotCapError(nested);
          }
        }
        return Array.isArray(parsed.message) ? parsed.message.join(", ") : typeof parsed.message === "string" ? parsed.message : undefined;
      } catch (error) {
        if (error instanceof ListingSlotCapError) throw error;
        return undefined;
      }
    })();
    if (res.status === 401) throw new BffAuthError(parsedMessage ?? "Login required");
    if (res.status === 402) throw new InsufficientContactRevealCreditsError(parsedMessage ?? "Insufficient contact reveal credits");
    if (res.status === 409) throw new ListingAlreadyClaimedError(parsedMessage ?? "This listing has already been claimed");
    throw new Error(parsedMessage ?? `BFF request failed (${res.status} ${path}): ${body}`);
  }
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

/** For BFF endpoints behind AuthGuard — attaches the BFF accessToken carried on the
 * NextAuth session (see src/auth.ts) as a Bearer token. */
export function authedBffFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  return bffFetch<T>(path, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers } });
}

export interface ListingsQuery {
  homeCategory?: HomeCategoryFilter;
  propertyType?: PropertyTypeFilter;
  /** Raw exact-attribute filters — used only by the SEO browse-landing pages, bypasses
   * homeCategory/propertyType tab-grouping entirely. */
  category?: ListingCategory;
  transactionType?: TransactionType;
  cityId?: string;
  areaId?: string;
  /** Multi-select area filter — several areas checked in the browse-page filter (some-but-not-all
   * of the city's areas). Mutually exclusive with `areaId` in practice. */
  areaIds?: string[];
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Multi-select BHK filter — one or more bedroom-count buckets (5 = "5+"), matched as an OR
   * of exact/`gte` clauses server-side. Mutually exclusive with a single-value bucket derived
   * from the SEO path facet in practice (the query param wins when both are present). */
  bedrooms?: number[];
  furnished?: "unfurnished" | "semi" | "furnished";
  sharingType?: string;
  condition?: string;
  serviceType?: string;
  cursor?: string;
  /** Offset-based page window for numbered `?page=N` pagination (browse pages + homepage) —
   * see docs/plans/seo-distinct-window-pagination.md. Mutually exclusive with `cursor`. */
  offset?: number;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
}

export function fetchListings(query: ListingsQuery, accessToken?: string): Promise<ListingsPage> {
  const params = new URLSearchParams();
  if (query.homeCategory) params.set("homeCategory", query.homeCategory);
  if (query.propertyType) params.set("propertyType", query.propertyType);
  if (query.category) params.set("category", query.category);
  if (query.transactionType) params.set("transactionType", query.transactionType);
  if (query.cityId) params.set("cityId", query.cityId);
  if (query.areaId) params.set("areaId", query.areaId);
  if (query.areaIds && query.areaIds.length > 0) params.set("areaIds", query.areaIds.join(","));
  if (query.q) params.set("q", query.q);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.bedrooms && query.bedrooms.length > 0) params.set("bedrooms", query.bedrooms.join(","));
  if (query.furnished) params.set("furnished", query.furnished);
  if (query.sharingType) params.set("sharingType", query.sharingType);
  if (query.condition) params.set("condition", query.condition);
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.sort) params.set("sort", query.sort);

  const path = `/listings?${params.toString()}`;
  return accessToken
    ? authedBffFetch(accessToken, path, { cache: "no-store" })
    : bffFetch<ListingsPage>(path, { cache: "no-store" });
}

export function fetchListingsSitemap(): Promise<ListingSitemapEntry[]> {
  return bffFetch<ListingSitemapEntry[]>("/listings/sitemap", { cache: "no-store" });
}

export function fetchPopularSearches(cityId?: string): Promise<PopularSearchDto[]> {
  const path = cityId ? `/listings/popular-searches?cityId=${cityId}` : "/listings/popular-searches";
  return bffFetch<PopularSearchDto[]>(path, { cache: "no-store" });
}

export function fetchCities(q?: string, all?: boolean): Promise<City[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<City[]>(`/locations/cities?${params.toString()}`, { cache: "no-store" });
}

/** Real Google-backed reverse geocoding — used both by the posting flow's map pin-picker and
 * by "Auto-detect my current location" in the homepage's city picker. The plain haversine
 * nearest-city version this replaced for the latter, and the automatic IP-based guess built on
 * top of it, were removed; see docs/plans/remove-automatic-ip-city-detection.md. */
export function reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResultDto> {
  return bffFetch<ReverseGeocodeResultDto>("/locations/reverse-geocode", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
    cache: "no-store",
  });
}

export function fetchAreas(cityId: string, q?: string, all?: boolean): Promise<Area[]> {
  const params = new URLSearchParams({ cityId });
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<Area[]>(`/locations/areas?${params.toString()}`, { cache: "no-store" });
}

// Not tied to any one listing — for the Plans page, which describes contact-reveal credits
// without a listing in context. The per-listing reveal flow gets pack size/price inlined on
// ListingCardDto/ListingDetailDto instead (see those types' own doc comments).
export function fetchContactRevealSettings(): Promise<ContactRevealSettingsDto> {
  return bffFetch<ContactRevealSettingsDto>("/listings/contact-reveal-settings", { cache: "no-store" });
}

/** app/[city]/[[...rest]]/page.tsx's page component calls this for the full listing — its
 * generateMetadata calls fetchListingMeta below instead, a separate lean endpoint, not this one.
 * They used to both call this function; an intentional-looking `cache()` wrap was tried to dedupe
 * that but measured no effect (confirmed via both `next dev` and a real `next build` +
 * standalone-server run, so not a dev-only/HMR artifact — generateMetadata and the page component
 * just don't share React's per-request cache scope in this Next.js App Router setup). Left
 * wrapped since it's harmless and correct for genuinely same-render callers elsewhere. */
export const fetchListingById = cache(function fetchListingById(
  id: string,
  accessToken?: string,
): Promise<ListingDetailDto> {
  return accessToken
    ? authedBffFetch(accessToken, `/listings/${id}`, { cache: "no-store" })
    : bffFetch<ListingDetailDto>(`/listings/${id}`, { cache: "no-store" });
});

/** The lean counterpart generateMetadata actually uses — see ListingMetaDto's own doc comment.
 * Doesn't need cache()/accessToken: this endpoint is public/anonymous, nothing it returns is
 * viewer-dependent. Still a real second network call on every listing-page load (that part is
 * the unavoidable Next.js limitation above), just a cheap one instead of the full detail fetch. */
export function fetchListingMeta(id: string): Promise<ListingMetaDto> {
  return bffFetch<ListingMetaDto>(`/listings/${id}/meta`, { cache: "no-store" });
}

// TEMP(auth-gate): posting is open without login for now — see CreateListingInput/BFF for the anonymous-owner fallback.
export function createListing(input: CreateListingInput, accessToken?: string): Promise<ListingDetailDto> {
  const init = { method: "POST", body: JSON.stringify(input) };
  return accessToken ? authedBffFetch(accessToken, "/listings", init) : bffFetch<ListingDetailDto>("/listings", init);
}

export function fetchMyListings(accessToken: string): Promise<ListingDetailDto[]> {
  return authedBffFetch(accessToken, "/users/me/listings", { cache: "no-store" });
}

export function fetchMyListing(accessToken: string, listingId: string): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/users/me/listings/${listingId}`, { cache: "no-store" });
}

export function fetchContactRevealBalance(accessToken: string): Promise<ContactRevealBalanceDto> {
  return authedBffFetch(accessToken, "/users/me/contact-reveal-credits", { cache: "no-store" });
}

export function fetchPaymentHistory(accessToken: string, cursor?: string): Promise<PaymentHistoryPage> {
  const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return authedBffFetch(accessToken, `/users/me/payments${params}`, { cache: "no-store" });
}

export function updateListing(accessToken: string, listingId: string, input: UpdateListingInput): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/listings/${listingId}`, { method: "PATCH", body: JSON.stringify(input) });
}

// Owner-facing photo controls — see docs/plans/listing-photo-cover-and-owner-controls.md. Same
// endpoints as the admin panel's rotate/set-cover, just without the AdminGuard: ListingsController
// checks the caller actually owns the listing instead.
export function rotateOwnListingPhoto(
  accessToken: string,
  listingId: string,
  photoNo: number,
  turns: number,
): Promise<{ rotation: number }> {
  return authedBffFetch(accessToken, `/listings/${listingId}/photos/${photoNo}/rotate`, {
    method: "POST",
    body: JSON.stringify({ turns }),
  });
}

export function setOwnListingCoverPhoto(
  accessToken: string,
  listingId: string,
  photoNo: number,
): Promise<{ displayOrder: number }> {
  return authedBffFetch(accessToken, `/listings/${listingId}/photos/${photoNo}/set-cover`, { method: "POST" });
}

/** Not routed through bffFetch/authedBffFetch — same reason as uploadPhoto below: those force a
 * JSON Content-Type, which would strip the multipart boundary fetch generates for a FormData
 * body. Photos are capped at 4MB, well under a Server Action's 12MB body limit, so this stays on
 * the Server Action path (unlike video's addVideoToListing, which has to bypass it via direct
 * XHR — see lib/videoUpload.ts). */
export async function addOwnListingPhoto(
  formData: FormData,
  accessToken: string,
  listingId: string,
): Promise<ListingDetailDto> {
  const res = await fetch(`${BFF_URL}/listings/${listingId}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BFF add photo failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<ListingDetailDto>;
}

export function deleteOwnListingPhoto(accessToken: string, listingId: string, photoNo: number): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/listings/${listingId}/photos/${photoNo}`, { method: "DELETE" });
}

export function renewListing(accessToken: string, listingId: string): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/listings/${listingId}/renew`, { method: "PATCH" });
}

/** Transfers a bulk-imported listing to the logged-in caller, if their verified phone matches
 * the one on file for that business. Throws (400) if the listing isn't claimable or was already
 * claimed, or (403) if the phone doesn't match. See ListingsService.claimListing. `source`
 * (email/whatsapp) records which outreach channel's link was actually clicked — see
 * Listing.claimSource. */
export function claimListing(
  accessToken: string,
  listingId: string,
  source?: "email" | "whatsapp",
): Promise<ListingDetailDto> {
  const params = source ? `?via=${source}` : "";
  return authedBffFetch(accessToken, `/listings/${listingId}/claim${params}`, { method: "POST" });
}

/** Unlike adding a video (which uploads a file and so must bypass Server Actions' 1MB body limit
 * — see lib/videoUpload.ts), deleting one carries no body and can go through the normal
 * server-action path like any other mutation here. */
export function deleteListingVideo(accessToken: string, listingId: string, videoId: string): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/listings/${listingId}/videos/${videoId}`, { method: "DELETE" });
}

export async function uploadPhoto(formData: FormData, accessToken: string): Promise<{ hash: string; ext: string }> {
  // Not routed through bffFetch/authedBffFetch — those force a JSON Content-Type, which would
  // strip the multipart boundary fetch otherwise auto-generates for a FormData body.
  const res = await fetch(`${BFF_URL}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BFF upload failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<{ hash: string; ext: string }>;
}

/** Not routed through bffFetch — that forces a JSON Content-Type, which would strip the
 * multipart boundary fetch generates for a FormData body (same reason as uploadPhoto above).
 * Unauthenticated by design: the contact form has to work for someone who can't log in. */
export async function submitSupportTicket(formData: FormData): Promise<CreateSupportTicketResponse> {
  const res = await fetch(`${BFF_URL}/support/tickets`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const message = (() => {
      try {
        const parsed = JSON.parse(body) as { message?: string | string[] };
        return Array.isArray(parsed.message) ? parsed.message.join(", ") : parsed.message;
      } catch {
        return undefined;
      }
    })();
    throw new Error(message ?? `Support ticket submission failed (${res.status})`);
  }
  return res.json() as Promise<CreateSupportTicketResponse>;
}

export function requestEmailCode(accessToken: string, email: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/users/me/email/request-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyEmail(accessToken: string, email: string, code: string): Promise<LinkIdentifierResult> {
  return authedBffFetch(accessToken, "/users/me/email/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function sendOtp(phone: string): Promise<{ success: true }> {
  return bffFetch("/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
}

export function fetchProfileNudge(accessToken: string): Promise<ProfileNudgeDto> {
  return authedBffFetch(accessToken, "/users/me/profile-nudge", { cache: "no-store" });
}

export function snoozeProfileNudge(accessToken: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/users/me/profile-nudge/snooze", { method: "POST" });
}

const ACQUISITION_COOKIE = "bhavano_acq";
const SESSION_COOKIE = "bhavano_sid";

/** Reads the two cookies middleware.ts sets on a visitor's first request — the permanent
 * first-touch acquisition source (UTM params, external referrer hostname, or "direct") and the
 * current session id — and forwards both on signup so AuthService can persist the acquisition
 * source onto the new User row and link the session's Visit log entry to it. A missing/malformed
 * cookie just means no attribution/linking is available — never blocks login. */
async function getVisitContext(): Promise<{
  acquisitionSource?: string;
  acquisitionMedium?: string;
  acquisitionCampaign?: string;
  acquisitionGclid?: string;
  acquisitionCampaignId?: string;
  acquisitionAdGroupId?: string;
  acquisitionAdId?: string;
  sessionId?: string;
}> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;

  const raw = jar.get(ACQUISITION_COOKIE)?.value;
  if (!raw) return { sessionId };
  try {
    const parsed = JSON.parse(raw) as {
      source?: string;
      medium?: string;
      campaign?: string;
      gclid?: string;
      campaignId?: string;
      adGroupId?: string;
      adId?: string;
    };
    return {
      acquisitionSource: parsed.source,
      acquisitionMedium: parsed.medium,
      acquisitionCampaign: parsed.campaign,
      acquisitionGclid: parsed.gclid,
      acquisitionCampaignId: parsed.campaignId,
      acquisitionAdGroupId: parsed.adGroupId,
      acquisitionAdId: parsed.adId,
      sessionId,
    };
  } catch {
    return { sessionId };
  }
}

export async function verifyOtp(phone: string, code: string): Promise<AuthSession> {
  return bffFetch("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code, ...(await getVisitContext()) }),
  });
}

export async function loginWithGoogle(idToken: string): Promise<AuthSession> {
  let visit: Awaited<ReturnType<typeof getVisitContext>> = {};
  try {
    visit = await getVisitContext();
  } catch {
    // Best-effort — OAuth callback should still mint a BFF session without attribution cookies.
  }
  return bffFetch("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken, ...visit }),
  });
}

/** Links a verified phone number to the currently logged-in user (e.g. a Google-login user
 * completing their profile) — distinct from verifyOtp(), which logs in/signs up by phone. */
export function linkPhone(accessToken: string, phone: string, code: string): Promise<LinkIdentifierResult> {
  return authedBffFetch(accessToken, "/auth/otp/link", { method: "POST", body: JSON.stringify({ phone, code }) });
}

/** No server-side session to end — this only exists so the BFF gets a logout signal to log
 * (see docs/plans/bff-loki-grafana-logging.md), since NextAuth's own signOut() never calls the
 * BFF on its own. */
export function logout(accessToken: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/auth/logout", { method: "POST" });
}

/** Creates a Razorpay order for boosting a listing — the boost itself only activates once the
 * BFF's webhook confirms payment, not from this call alone. See
 * docs/plans/monetization-boosted-listings-premium-tiers.md. */
export function createBoostOrder(
  accessToken: string,
  listingId: string,
  boostDays: BoostDurationDays,
): Promise<CreateBoostOrderResponseDto> {
  return authedBffFetch(accessToken, "/payments/orders", { method: "POST", body: JSON.stringify({ listingId, boostDays }) });
}

/** Same pattern as createBoostOrder — buyerPremium ("Bhavano Plus") and agentPro
 * ("Agent/Broker Pro") both activate via the webhook, not from this call alone. */
export function createSubscriptionOrder(
  accessToken: string,
  tier: SubscriptionTier,
  months: number,
  agentProUnits?: number,
): Promise<CreateSubscriptionOrderResponseDto> {
  return authedBffFetch(accessToken, "/payments/subscriptions", {
    method: "POST",
    body: JSON.stringify({ tier, months, ...(agentProUnits !== undefined ? { agentProUnits } : {}) }),
  });
}

/** Same pattern as createBoostOrder — activates via the webhook, not from this call alone. See
 * docs/plans/contact-reveal-credits.md. */
export function createContactRevealCreditsOrder(
  accessToken: string,
  discountCode?: string,
): Promise<CreateContactRevealCreditsOrderResponseDto> {
  return authedBffFetch(accessToken, "/payments/contact-reveal-credits", {
    method: "POST",
    body: JSON.stringify(discountCode ? { discountCode } : {}),
  });
}

/** Public — no accessToken, anyone can view an agent's storefront. */
export function fetchAgentStorefront(userId: string): Promise<AgentStorefrontDto> {
  return bffFetch<AgentStorefrontDto>(`/agents/${userId}`, { cache: "no-store" });
}

export function fetchSavedSearches(accessToken: string): Promise<SavedSearchDto[]> {
  return authedBffFetch(accessToken, "/saved-searches", { cache: "no-store" });
}

export function createSavedSearch(accessToken: string, input: CreateSavedSearchInput): Promise<SavedSearchDto> {
  return authedBffFetch(accessToken, "/saved-searches", { method: "POST", body: JSON.stringify(input) });
}

export function deleteSavedSearch(accessToken: string, id: string): Promise<void> {
  return authedBffFetch(accessToken, `/saved-searches/${id}`, { method: "DELETE" });
}

export function recordView(listingId: string, viewerKey: string, accessToken?: string): Promise<{ viewCount: number }> {
  const path = `/listings/${listingId}/view`;
  const init = { method: "POST", body: JSON.stringify({ viewerKey }) };
  return accessToken ? authedBffFetch(accessToken, path, init) : bffFetch(path, init);
}

export function toggleFavourite(
  accessToken: string,
  listingId: string,
): Promise<{ favourited: boolean; likeCount: number }> {
  return authedBffFetch(accessToken, `/listings/${listingId}/favourite`, { method: "POST" });
}

export function fetchFavourites(accessToken: string): Promise<ListingCardDto[]> {
  return authedBffFetch(accessToken, "/users/me/favourites", { cache: "no-store" });
}

export function fetchProfile(accessToken: string): Promise<UserProfileDto> {
  return authedBffFetch(accessToken, "/users/me", { cache: "no-store" });
}

export function updateProfile(accessToken: string, input: UpdateProfileInput): Promise<UserProfileDto> {
  return authedBffFetch(accessToken, "/users/me", { method: "PATCH", body: JSON.stringify(input) });
}

export function createConversation(accessToken: string, listingId: string): Promise<{ id: string }> {
  return authedBffFetch(accessToken, "/conversations", { method: "POST", body: JSON.stringify({ listingId }) });
}

/** Spends a free reveal or a credit (whichever applies) and permanently unlocks this listing's
 * owner contact for this user. Throws (status 402) when neither is available — the caller opens
 * the credit-purchase flow in that case. See docs/plans/contact-reveal-credits.md. */
export function revealContact(accessToken: string, listingId: string): Promise<RevealContactResponseDto> {
  return authedBffFetch(accessToken, `/listings/${listingId}/reveal-contact`, { method: "POST" });
}

export function fetchConversations(accessToken: string): Promise<ConversationSummaryDto[]> {
  return authedBffFetch(accessToken, "/conversations", { cache: "no-store" });
}

export function fetchConversation(accessToken: string, conversationId: string): Promise<ConversationDetailDto> {
  return authedBffFetch(accessToken, `/conversations/${conversationId}`, { cache: "no-store" });
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

export function markConversationRead(accessToken: string, conversationId: string): Promise<void> {
  return authedBffFetch(accessToken, `/conversations/${conversationId}/read`, { method: "POST" });
}

/** Total unread messages across all of the caller's conversations — the number on the Messages
 * count badge in the header. */
export function fetchUnreadCount(accessToken: string): Promise<{ count: number }> {
  return authedBffFetch(accessToken, "/conversations/unread-count", { cache: "no-store" });
}

/** Executes a merge the user approved. `code` is the same one proven when the server answered
 * `confirm` — that request deliberately left the challenge valid. */
export function confirmAccountMerge(
  accessToken: string,
  identifier: { phone?: string; email?: string; code: string },
): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/users/me/merge/confirm", {
    method: "POST",
    body: JSON.stringify(identifier),
  });
}

/** Deletes the caller's own account. Irreversible: the identifiers are released and every
 * identifying field cleared, so there is no undo from the client side. */
export function deleteAccount(
  accessToken: string,
  identifier: { phone?: string; email?: string; code: string },
): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/users/me", {
    method: "DELETE",
    body: JSON.stringify(identifier),
  });
}
