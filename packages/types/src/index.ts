export type ListingCategory = "house" | "apartment" | "pg" | "storage" | "coworking" | "furniture";

export type TransactionType = "buy" | "sell" | "rent" | "lease";

export type ListingStatus = "active" | "sold" | "rented" | "deactivated";

export type ListingCondition = "new" | "used";

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
export type HomeCategoryFilter = "buy" | "rentLease" | "pg" | "furniture";

/** Sub-filter shown under the Buy / Rent & Lease tabs only. */
export type PropertyTypeFilter = "house" | "apartment" | "storage" | "coworking";

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

export interface ListingDetailDto extends ListingCardDto {
  attributes: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface CreateListingInput {
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
  photos?: string[];
  /** Parallel to `photos` — the dHash of each uploaded photo, used for duplicate detection. */
  photoHashes?: string[];
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
}
