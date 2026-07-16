import "server-only";
import type {
  Area,
  AuthSession,
  City,
  ConversationSummaryDto,
  CreateListingInput,
  HomeCategoryFilter,
  ListingCardDto,
  ListingCategory,
  ListingDetailDto,
  ListingSitemapEntry,
  ListingsPage,
  MessageDto,
  PropertyTypeFilter,
  TransactionType,
  UpdateProfileInput,
  UserProfileDto,
} from "@bhavano/types";

const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:4000";

async function bffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BFF request failed (${res.status} ${path}): ${body}`);
  }
  return res.json() as Promise<T>;
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
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  /** "N+" style — matches attributes.bedrooms >= bedrooms, not exact match. */
  bedrooms?: number;
  furnished?: "unfurnished" | "semi" | "furnished";
  cursor?: string;
  limit?: number;
}

export function fetchListings(query: ListingsQuery, accessToken?: string): Promise<ListingsPage> {
  const params = new URLSearchParams();
  if (query.homeCategory) params.set("homeCategory", query.homeCategory);
  if (query.propertyType) params.set("propertyType", query.propertyType);
  if (query.category) params.set("category", query.category);
  if (query.transactionType) params.set("transactionType", query.transactionType);
  if (query.cityId) params.set("cityId", query.cityId);
  if (query.areaId) params.set("areaId", query.areaId);
  if (query.q) params.set("q", query.q);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.bedrooms !== undefined) params.set("bedrooms", String(query.bedrooms));
  if (query.furnished) params.set("furnished", query.furnished);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));

  const path = `/listings?${params.toString()}`;
  return accessToken
    ? authedBffFetch(accessToken, path, { cache: "no-store" })
    : bffFetch<ListingsPage>(path, { cache: "no-store" });
}

export function fetchListingsSitemap(): Promise<ListingSitemapEntry[]> {
  return bffFetch<ListingSitemapEntry[]>("/listings/sitemap", { cache: "no-store" });
}

export function fetchCities(q?: string): Promise<City[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  return bffFetch<City[]>(`/locations/cities?${params.toString()}`, { cache: "no-store" });
}

export function reverseGeocode(lat: number, lng: number): Promise<City | null> {
  return bffFetch<City | null>(`/locations/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
}

export function fetchAreas(cityId: string, q?: string): Promise<Area[]> {
  const params = new URLSearchParams({ cityId });
  if (q) params.set("q", q);
  return bffFetch<Area[]>(`/locations/areas?${params.toString()}`, { cache: "no-store" });
}

export function fetchListingById(id: string, accessToken?: string): Promise<ListingDetailDto> {
  return accessToken
    ? authedBffFetch(accessToken, `/listings/${id}`, { cache: "no-store" })
    : bffFetch<ListingDetailDto>(`/listings/${id}`, { cache: "no-store" });
}

// TEMP(auth-gate): posting is open without login for now — see CreateListingInput/BFF for the anonymous-owner fallback.
export function createListing(input: CreateListingInput): Promise<ListingDetailDto> {
  return bffFetch<ListingDetailDto>("/listings", { method: "POST", body: JSON.stringify(input) });
}

export async function uploadPhoto(formData: FormData): Promise<{ url: string; hash: string }> {
  const res = await fetch(`${BFF_URL}/uploads`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`BFF upload failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<{ url: string; hash: string }>;
}

export function sendOtp(phone: string): Promise<{ success: true }> {
  return bffFetch("/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
}

export function verifyOtp(phone: string, code: string): Promise<AuthSession> {
  return bffFetch("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function loginWithGoogle(idToken: string): Promise<AuthSession> {
  return bffFetch("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) });
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
