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
  q?: string;
  limit?: number;
}

export function fetchListings(query: ListingsQuery, accessToken?: string | null): Promise<ListingsPage> {
  const params = new URLSearchParams();
  if (query.homeCategory) params.set("homeCategory", query.homeCategory);
  if (query.propertyType) params.set("propertyType", query.propertyType);
  if (query.cityId) params.set("cityId", query.cityId);
  if (query.q) params.set("q", query.q);
  if (query.limit) params.set("limit", String(query.limit));
  const path = `/listings?${params.toString()}`;
  return accessToken ? authedBffFetch(accessToken, path) : bffFetch<ListingsPage>(path);
}

export function fetchCities(q?: string): Promise<City[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  return bffFetch<City[]>(`/locations/cities?${params.toString()}`);
}

export function reverseGeocode(lat: number, lng: number): Promise<City | null> {
  return bffFetch<City | null>(`/locations/reverse?lat=${lat}&lng=${lng}`);
}

export function fetchAreas(cityId: string, q?: string): Promise<Area[]> {
  const params = new URLSearchParams({ cityId });
  if (q) params.set("q", q);
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
export function createListing(input: CreateListingInput): Promise<ListingDetailDto> {
  return bffFetch<ListingDetailDto>("/listings", { method: "POST", body: JSON.stringify(input) });
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
): Promise<{ hash: string; ext: string }> {
  const formData = new FormData();
  const filename = fileUri.split("/").pop() ?? "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeType = (ext && MIME_BY_EXT[ext]) ?? "image/jpeg";
  // React Native's fetch accepts this { uri, name, type } shape for multipart file fields.
  formData.append("file", { uri: fileUri, name: filename, type: mimeType } as unknown as Blob);
  formData.append("listingId", listingId);
  formData.append("photoNo", String(photoNo));

  const res = await fetch(`${BFF_URL}/uploads`, { method: "POST", body: formData });
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
