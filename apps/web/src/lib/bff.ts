import "server-only";
import { cookies } from "next/headers";
import type {
  AgentStorefrontDto,
  Area,
  AuthSession,
  City,
  ConversationSummaryDto,
  CreateBoostOrderResponseDto,
  CreateListingInput,
  CreateSavedSearchInput,
  CreateSubscriptionOrderResponseDto,
  HomeCategoryFilter,
  ListingCardDto,
  ListingCategory,
  ListingDetailDto,
  ListingSitemapEntry,
  ListingsPage,
  MessageDto,
  PopularSearchDto,
  PropertyTypeFilter,
  SavedSearchDto,
  SubscriptionTier,
  TransactionType,
  UpdateListingInput,
  UpdateProfileInput,
  UserProfileDto,
} from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";

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
    if (res.status === 401) throw new BffAuthError(parsedMessage ?? "Login required");
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

export function reverseGeocode(lat: number, lng: number): Promise<City | null> {
  return bffFetch<City | null>(`/locations/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
}

export function fetchAreas(cityId: string, q?: string, all?: boolean): Promise<Area[]> {
  const params = new URLSearchParams({ cityId });
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<Area[]>(`/locations/areas?${params.toString()}`, { cache: "no-store" });
}

export function fetchListingById(id: string, accessToken?: string): Promise<ListingDetailDto> {
  return accessToken
    ? authedBffFetch(accessToken, `/listings/${id}`, { cache: "no-store" })
    : bffFetch<ListingDetailDto>(`/listings/${id}`, { cache: "no-store" });
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

export function updateListing(accessToken: string, listingId: string, input: UpdateListingInput): Promise<ListingDetailDto> {
  return authedBffFetch(accessToken, `/listings/${listingId}`, { method: "PATCH", body: JSON.stringify(input) });
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

export function sendOtp(phone: string): Promise<{ success: true }> {
  return bffFetch("/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
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
  sessionId?: string;
}> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;

  const raw = jar.get(ACQUISITION_COOKIE)?.value;
  if (!raw) return { sessionId };
  try {
    const parsed = JSON.parse(raw) as { source?: string; medium?: string; campaign?: string };
    return {
      acquisitionSource: parsed.source,
      acquisitionMedium: parsed.medium,
      acquisitionCampaign: parsed.campaign,
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
  return bffFetch("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken, ...(await getVisitContext()) }),
  });
}

/** Links a verified phone number to the currently logged-in user (e.g. a Google-login user
 * completing their profile) — distinct from verifyOtp(), which logs in/signs up by phone. */
export function linkPhone(accessToken: string, phone: string, code: string): Promise<{ success: true }> {
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
): Promise<CreateSubscriptionOrderResponseDto> {
  return authedBffFetch(accessToken, "/payments/subscriptions", { method: "POST", body: JSON.stringify({ tier, months }) });
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

export function markConversationRead(accessToken: string, conversationId: string): Promise<void> {
  return authedBffFetch(accessToken, `/conversations/${conversationId}/read`, { method: "POST" });
}
