export type ListingCategory =
  | "house"
  | "apartment"
  | "pg"
  | "storage"
  | "coworking"
  | "furniture"
  | "interiors"
  | "plot"
  | "commercial";

export type TransactionType = "buy" | "sell" | "rent" | "lease";

export type ListingStatus = "active" | "sold" | "rented" | "deactivated";

export type ListingCondition = "new" | "used";

export type UserRole = "user" | "admin";

/** approved = normal/visible; flagged = an admin took it offline pending a fix from the
 * owner — this IS the soft-delete, there's no separate "deleted" state. */
export type ModerationState = "approved" | "flagged";

/** inquiry = buyer/seller chat about a listing; moderation = admin↔owner thread about a
 * flagged listing. Kept distinct so an admin's thread can't collide with a real buyer's. */
export type ConversationType = "inquiry" | "moderation";

export type LoginMethod = "otp" | "google";

export type RateLimitKind = "publish" | "view";

export type PaymentStatus = "created" | "paid" | "failed" | "refunded";

/** Only "listing_boost" exists today — see docs/plans/monetization-boosted-listings-premium-tiers.md
 * for the planned buyer/seller subscription purposes, not yet built. */
export type PaymentPurpose = "listing_boost";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Listing {
  id: string;
  category: ListingCategory;
  transactionType: TransactionType;
  price: number;
  location: GeoPoint;
  ownerId: string;
  status: ListingStatus;
  condition?: ListingCondition;
  relatedListingId?: string;
  attributes: Record<string, unknown>;
  createdAt: string;
}

/** Homepage top-level browsing tab — organized around seeker intent, not a flat
 * (category x transactionType) grid. "buy"/"rentLease" filter by transactionType
 * (+ an optional propertyType sub-filter); "pg"/"furniture" filter by category alone. */
export type HomeCategoryFilter = "buy" | "rentLease" | "pg" | "furniture" | "interiors";

/** Sub-filter shown under the Buy / Rent & Lease tabs only. */
export type PropertyTypeFilter = "house" | "apartment" | "storage" | "coworking" | "plot" | "commercial";

export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  isPopular: boolean;
}

export interface Area {
  id: string;
  name: string;
  cityId: string;
  lat: number | null;
  lng: number | null;
}

/** Shape the BFF returns for homepage listing cards — already formatted for direct rendering. */
export interface ListingCardDto {
  id: string;
  category: ListingCategory;
  transactionType: TransactionType;
  /** URL slug generated from the title at creation — combine with `id` to build the
   * canonical SEO path (see apps/web/src/lib/listingPath.ts). */
  slug: string;
  tag: string;
  price: string;
  priceQualifier: string;
  title: string;
  area: string;
  cityName: string;
  specs: string[];
  imgLabel: string;
  imgColors: [string, string];
  photos: string[];
  viewCount: number;
  likeCount: number;
  /** Whether the requesting (logged-in) viewer has favourited this listing — always
   * false for anonymous requests, since favouriting requires login. */
  isFavourited: boolean;
  /** True while `Listing.boostedUntil` is in the future — drives the "⭐ Featured" badge and
   * the boosted-first sort. See docs/plans/monetization-boosted-listings-premium-tiers.md. */
  isBoosted: boolean;
}

export interface ListingsPage {
  items: ListingCardDto[];
  nextCursor: string | null;
  total: number;
}

/** Minimal shape for sitemap.xml generation — every active, non-expired listing. */
export interface ListingSitemapEntry {
  id: string;
  slug: string;
  category: ListingCategory;
  transactionType: TransactionType;
  cityName: string;
  area: string;
  updatedAt: string;
}

/** A real (category, transactionType, city) combination with active inventory — feeds the
 * footer's "Popular searches" so it reflects actual listings instead of hardcoded examples. */
export interface PopularSearchDto {
  cityName: string;
  category: ListingCategory;
  transactionType: TransactionType;
  count: number;
}

export interface ListingDetailDto extends ListingCardDto {
  status: ListingStatus;
  moderationState: ModerationState;
  adminReviewed: boolean;
  moderatedAt: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  /** Full-size (1600px-wide) variant URLs, same order as `photos` (the preview variants) —
   * used for the detail page gallery instead of the card-sized preview images. */
  photosFull: string[];
}

/** Fields an owner can change after posting — from the my-listings edit form. */
export interface UpdateListingInput {
  price?: number;
  priceQualifier?: string;
  title?: string;
  specs?: string[];
  attributes?: Record<string, unknown>;
  status?: ListingStatus;
}

/** One uploaded photo's metadata as returned by `POST /uploads` — `photoNo` matches the key
 * that upload was stored under (see apps/bff/src/uploads/photo-keys.ts). */
export interface CreatedPhotoInput {
  photoNo: number;
  hash: string;
  ext: string;
}

export interface CreateListingInput {
  /** Client-generated (UUID) before any photo is uploaded, so upload keys and the listing's
   * real id agree from the very first upload — no post-creation rename step needed. */
  id: string;
  category: ListingCategory;
  transactionType: TransactionType;
  price: number;
  priceQualifier?: string;
  title: string;
  /** Exactly one of areaId/areaName should be set — areaId picks an existing Area,
   * areaName creates one (case-insensitively matched first) if it doesn't already exist. */
  areaId?: string;
  areaName?: string;
  cityId: string;
  specs?: string[];
  photos: CreatedPhotoInput[];
  /** Category-specific field values from the posting wizard's schema-driven step —
   * maps directly onto the `attributes` JSONB column. */
  attributes?: Record<string, unknown>;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface ConversationSummaryDto {
  id: string;
  listingId: string;
  listingTitle: string;
  type: ConversationType;
  otherPartyId: string;
  otherPartyName: string;
  lastMessage: MessageDto | null;
  unreadCount: number;
}

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  name?: string;
  role: UserRole;
}

export interface AuthSession {
  user: AuthUser;
  accessToken?: string;
}

export interface UserProfileDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cityId: string | null;
  cityName: string | null;
  state: string | null;
}

export interface UpdateProfileInput {
  name?: string;
  cityId?: string;
  /** Only accepted when the profile doesn't already have an email — e.g. a phone-login
   * user completing their profile. Once set, it's shown read-only. */
  email?: string;
}

/** Admin moderation queue — same listing shape as the public/owner views, just without the
 * `moderationState: 'approved'` filter the public browse endpoint applies. */
export interface AdminListingsPage {
  items: ListingDetailDto[];
  nextCursor: string | null;
  total: number;
}

export interface FlagListingInput {
  /** The discrepancy explained to the owner — posted as the first message of the
   * moderation thread between them and the flagging admin. */
  message: string;
}

export interface LoginEventDto {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  method: LoginMethod;
  createdAt: string;
}

export interface LoginEventsPage {
  items: LoginEventDto[];
  nextCursor: string | null;
  total: number;
}

/** One entry in a user's merged activity timeline — sourced from several tables
 * (logins, listings, messages, favourites, views) and returned pre-sorted, newest first. */
export interface ActivityEventDto {
  type: "login" | "listing_posted" | "listing_updated" | "message_sent" | "favourite_added" | "listing_viewed";
  timestamp: string;
  summary: string;
  /** Id of the underlying record (listing id, message id, etc.) — not linked to anything yet,
   * kept for future drill-down. */
  refId?: string;
}

export interface UserActivityDto {
  user: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    cityName: string | null;
    role: UserRole;
    createdAt: string;
  };
  events: ActivityEventDto[];
}

export interface ListingOwnerDto {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface RateLimitSettingsDto {
  publishLimit: number;
  publishWindowMinutes: number;
  viewLimit: number;
  viewWindowMinutes: number;
}

export type UpdateRateLimitSettingsInput = RateLimitSettingsDto;

export interface CreateBoostOrderInput {
  listingId: string;
  boostDays: 7 | 15;
}

/** Everything the web app's Razorpay Checkout needs to open the payment sheet — `razorpayKeyId`
 * is the public key (safe to expose to the client), never the secret. */
export interface CreateBoostOrderResponseDto {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

/** Admin's boost-management list — who bought it, for how long, on which listing. */
export interface ListingBoostDto {
  id: string;
  listingId: string;
  listingTitle: string;
  ownerName: string | null;
  boostedFrom: string;
  boostedUntil: string;
  amount: number;
  currency: string;
}

export interface ListingBoostsPage {
  items: ListingBoostDto[];
  nextCursor: string | null;
  total: number;
}
