import type {
  Area,
  City,
  ConversationSummaryDto,
  CreateListingInput,
  HomeCategoryFilter,
  ListingCardDto,
  ListingDetailDto,
  ListingsPage,
  MessageDto,
  PropertyTypeFilter,
  ReverseGeocodeResultDto,
  UpdateProfileInput,
  UserProfileDto,
} from "@bhavano/types";

const BFF_URL = process.env.EXPO_PUBLIC_BFF_URL ?? "http://localhost:4000";

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

function authedBffFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  return bffFetch<T>(path, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers } });
}

export interface ListingsQuery {
  homeCategory?: HomeCategoryFilter;
  propertyType?: PropertyTypeFilter;
  cityId?: string;
  /** Multi-select area filter — comma-joined area ids, same wire format as the web app's
   * AreaFilter (see docs/plans/mobile-filters-and-sort.md). */
  areaIds?: string[];
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Multi-select BHK filter — one or more bedroom-count buckets (5 = "5+"). */
  bedrooms?: number[];
  furnished?: "unfurnished" | "semi" | "furnished";
  /** Append-style infinite-scroll cursor — pass back the previous page's `nextCursor`. */
  cursor?: string;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
}

export function fetchListings(query: ListingsQuery, accessToken?: string | null): Promise<ListingsPage> {
  const params = new URLSearchParams();
  if (query.homeCategory) params.set("homeCategory", query.homeCategory);
  if (query.propertyType) params.set("propertyType", query.propertyType);
  if (query.cityId) params.set("cityId", query.cityId);
  if (query.areaIds && query.areaIds.length > 0) params.set("areaIds", query.areaIds.join(","));
  if (query.q) params.set("q", query.q);
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.bedrooms && query.bedrooms.length > 0) params.set("bedrooms", query.bedrooms.join(","));
  if (query.furnished) params.set("furnished", query.furnished);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.sort) params.set("sort", query.sort);
  const path = `/listings?${params.toString()}`;
  return accessToken ? authedBffFetch(accessToken, path) : bffFetch<ListingsPage>(path);
}

export function fetchCities(q?: string, all?: boolean): Promise<City[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<City[]>(`/locations/cities?${params.toString()}`);
}

export function reverseGeocode(lat: number, lng: number): Promise<City | null> {
  return bffFetch<City | null>(`/locations/reverse?lat=${lat}&lng=${lng}`);
}

/** Real Google-backed reverse geocoding for the posting flow's map pin-picker — distinct from
 * `reverseGeocode` above (the "auto-detect my location" haversine lookup). Proxied through the
 * BFF (server-side GOOGLE_MAPS_SERVER_KEY), not called directly from the device — an
 * Android-app-restricted API key doesn't reliably work for a plain fetch() call the way it does
 * for the native Maps SDK's own rendering, so this avoids needing a second, awkwardly-restricted
 * Google key in the mobile bundle. See docs/plans/google-maps-location-picker.md. */
export function reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResultDto> {
  return bffFetch<ReverseGeocodeResultDto>("/locations/reverse-geocode", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
}

export function fetchAreas(cityId: string, q?: string, all?: boolean): Promise<Area[]> {
  const params = new URLSearchParams({ cityId });
  if (q) params.set("q", q);
  if (all) params.set("all", "true");
  return bffFetch<Area[]>(`/locations/areas?${params.toString()}`);
}

export function fetchListingById(id: string, accessToken?: string | null): Promise<ListingDetailDto> {
  return accessToken
    ? authedBffFetch(accessToken, `/listings/${id}`)
    : bffFetch<ListingDetailDto>(`/listings/${id}`);
}

export function recordView(
  listingId: string,
  viewerKey: string,
  accessToken?: string | null,
): Promise<{ viewCount: number }> {
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
  return authedBffFetch(accessToken, "/users/me/favourites");
}

export function createConversation(accessToken: string, listingId: string): Promise<{ id: string }> {
  return authedBffFetch(accessToken, "/conversations", { method: "POST", body: JSON.stringify({ listingId }) });
}

export function fetchConversations(accessToken: string): Promise<ConversationSummaryDto[]> {
  return authedBffFetch(accessToken, "/conversations");
}

export function fetchMessages(accessToken: string, conversationId: string): Promise<MessageDto[]> {
  return authedBffFetch(accessToken, `/conversations/${conversationId}/messages`);
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

// TEMP(auth-gate): posting is open without login for now.
export function createListing(input: CreateListingInput, accessToken: string): Promise<ListingDetailDto> {
  return authedBffFetch<ListingDetailDto>(accessToken, "/listings", { method: "POST", body: JSON.stringify(input) });
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export async function uploadPhoto(
  fileUri: string,
  listingId: string,
  photoNo: number,
  accessToken: string,
): Promise<{ hash: string; ext: string }> {
  const formData = new FormData();
  const filename = fileUri.split("/").pop() ?? "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeType = (ext && MIME_BY_EXT[ext]) ?? "image/jpeg";
  // React Native's fetch accepts this { uri, name, type } shape for multipart file fields.
  formData.append("file", { uri: fileUri, name: filename, type: mimeType } as unknown as Blob);
  formData.append("listingId", listingId);
  formData.append("photoNo", String(photoNo));

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

export function verifyOtp(
  phone: string,
  code: string,
): Promise<{ user: { id: string; phone?: string; name?: string }; accessToken: string }> {
  return bffFetch("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
}

export function loginWithGoogle(
  idToken: string,
): Promise<{ user: { id: string; email?: string; name?: string }; accessToken: string }> {
  return bffFetch("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) });
}

export function fetchProfile(accessToken: string): Promise<UserProfileDto> {
  return authedBffFetch(accessToken, "/users/me");
}

export function updateProfile(accessToken: string, input: UpdateProfileInput): Promise<UserProfileDto> {
  return authedBffFetch(accessToken, "/users/me", { method: "PATCH", body: JSON.stringify(input) });
}

/** Links a verified phone number to the currently logged-in user (e.g. a Google-login user
 * completing their profile) — distinct from verifyOtp() (login/signup by phone). */
export function linkPhone(accessToken: string, phone: string, code: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/auth/otp/link", { method: "POST", body: JSON.stringify({ phone, code }) });
}
