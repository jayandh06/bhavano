import "server-only";
import type {
  AdminListingsPage,
  AuthSession,
  ConversationSummaryDto,
  FlagListingInput,
  ListingDetailDto,
  ListingOwnerDto,
  LoginEventsPage,
  MessageDto,
  ModerationState,
  RateLimitSettingsDto,
  UserActivityDto,
} from "@bhavano/types";

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

export function loginWithGoogle(idToken: string): Promise<AuthSession> {
  return bffFetch("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) });
}

export interface AdminListingsQuery {
  moderationState?: ModerationState;
  adminReviewed?: boolean;
  cursor?: string;
  limit?: number;
}

export function fetchAdminListings(accessToken: string, query: AdminListingsQuery): Promise<AdminListingsPage> {
  const params = new URLSearchParams();
  if (query.moderationState) params.set("moderationState", query.moderationState);
  if (query.adminReviewed !== undefined) params.set("adminReviewed", String(query.adminReviewed));
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/listings?${params.toString()}`, { cache: "no-store" });
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

export interface RecentLoginsQuery {
  cursor?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export function fetchRecentLogins(accessToken: string, query: RecentLoginsQuery = {}): Promise<LoginEventsPage> {
  const params = new URLSearchParams();
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit) params.set("limit", String(query.limit));
  return authedBffFetch(accessToken, `/admin/logins?${params.toString()}`, { cache: "no-store" });
}

export function fetchUserActivity(accessToken: string, userId: string): Promise<UserActivityDto> {
  return authedBffFetch(accessToken, `/admin/users/${userId}/activity`, { cache: "no-store" });
}

export function fetchRateLimitSettings(accessToken: string): Promise<RateLimitSettingsDto> {
  return authedBffFetch(accessToken, "/admin/rate-limits", { cache: "no-store" });
}

export function updateRateLimitSettings(accessToken: string, input: RateLimitSettingsDto): Promise<RateLimitSettingsDto> {
  return authedBffFetch(accessToken, "/admin/rate-limits", { method: "PATCH", body: JSON.stringify(input) });
}
