import type { VideoEntitlement } from "./videoLimits";

export type ListingCategory =
  | "house"
  | "apartment"
  | "villa"
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

export type ListingSlotUpsell = import("./listingSlots").ListingSlotUpsell;
export type { ListingSlotCapErrorBody } from "./listingSlots";

export type PaymentPurpose = "listing_boost" | "buyer_premium" | "agent_pro" | "seller_slot_pack";

/** buyerPremium = Bhavano Plus; agentPro = broker slots + storefront; sellerSlotPack = +5 slots (10 total). */
export type SubscriptionTier = "buyerPremium" | "agentPro" | "sellerSlotPack";

/** Homepage top-level browsing tab — organized around seeker intent, not a flat
 * (category x transactionType) grid. "buy"/"rentLease" filter by transactionType
 * (+ an optional propertyType sub-filter); "pg"/"furniture" filter by category alone. */
export type HomeCategoryFilter = "buy" | "rentLease" | "pg" | "furniture" | "interiors";

/** Sub-filter shown under the Buy / Rent & Lease tabs only. */
export type PropertyTypeFilter = "house" | "apartment" | "villa" | "storage" | "coworking" | "plot" | "commercial";

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
  /** Whether at least one processed (status "done") video exists — drives a "▶ Video" browse-card
   * badge. Deliberately not the full `videos[]` array here (see ListingDetailDto.videos) since
   * browse pages render 20+ cards and none of them play video. See docs/plans/listing-video-uploads.md. */
  hasVideo: boolean;
  /** The viewer posted this listing. Hides the contact actions on the card, for the same reason
   * as on the detail page — always false for an anonymous viewer, who owns nothing. */
  isOwner: boolean;
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
  /** The seller's own prose. Null for anything posted before the field existed — most listings.
   * Distinct from `specs`, which are the short chips the card renders in one row. */
  description: string | null;
  status: ListingStatus;
  moderationState: ModerationState;
  adminReviewed: boolean;
  moderatedAt: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isExpired: boolean;
  /** Full-size (1600px-wide) variant URLs, same order as `photos` (the preview variants) —
   * used for the detail page gallery instead of the card-sized preview images. */
  photosFull: string[];
  /** listingPhotos.photoNo for each entry, same order as `photosFull` — lets the admin rotate
   * control identify a photo by its real number rather than assuming array index === photoNo,
   * which would silently break if a photo were ever deleted out of the middle of the sequence. */
  photoNos: number[];
  /** listingPhotos.rotation for each entry, same order as `photosFull` — the admin UI appends
   * this to the image URL as a cache-busting query param. Variant keys never change (see
   * apps/bff/src/uploads/photo-keys.ts) even after a rotate, only their bytes do, so without this
   * a browser (or CDN) that already cached the old bytes at that URL would keep serving them. */
  photoRotations: number[];
  /** Only ever `status: "done"` entries for a non-owner/non-admin viewer — filtered server-side
   * in ListingsService.toDetailDto so a <video> tag never points at an object that doesn't exist
   * yet. Owners/admins see every status so the UI can show a "Processing…" state. */
  videos: ListingVideoDto[];
  /** Only populated when the requester owns the listing (or is an admin) — resolved server-side
   * by resolveVideoEntitlement() so the client never re-derives tier from agentProUntil/
   * boostedUntil itself and can never disagree with what the write path will accept. */
  videoEntitlement?: VideoEntitlement;
  /** How many times the owner has renewed this listing (pushed `expiresAt` forward). */
  renewCount: number;
  /** Newest-first renewal audit trail — each entry's `from`/`to` are the expiry dates either
   * side of that renewal. Only populated for the owner (or an admin), like `videoEntitlement`. */
  renewalHistory?: ListingRenewalDto[];
  /** Always a jittered/snapped approximation of the real pin (computed server-side in
   * ListingsService.toDetailDto — see docs/plans/google-maps-location-picker.md), never the
   * seller's exact dropped location, regardless of who's asking. Undefined if no pin was set
   * at posting time. */
  lat?: number;
  lng?: number;
}

export interface ListingRenewalDto {
  from: string;
  to: string;
  renewedAt: string;
}

/** Fields an owner can change after posting — from the my-listings edit form. */
export interface UpdateListingInput {
  price?: number;
  priceQualifier?: string;
  title?: string;
  specs?: string[];
  description?: string;
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

/** One uploaded video's metadata as returned by `POST /uploads/video` — no `videoNo` here (unlike
 * `CreatedPhotoInput`): the wizard's array order becomes `videoNo` server-side in
 * ListingsService.create(). `storageId` is the opaque, server-minted identifier used in the R2
 * key — see apps/bff/src/uploads/video-keys.ts for why it's not `videoNo`. */
export interface CreatedVideoInput {
  storageId: string;
  ext: string;
  /** ffprobe-verified server-side at upload time, never client-reported. */
  durationSec: number;
  sizeBytes: number;
}

/** One video attached to a listing — see docs/plans/listing-video-uploads.md. */
export interface ListingVideoDto {
  id: string;
  videoNo: number;
  url: string;
  posterUrl: string;
  durationSec: number;
  status: "pending" | "processing" | "done" | "failed";
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
  description?: string;
  photos: CreatedPhotoInput[];
  /** Optional — video is additive, never required. Entitlement (Agent Pro only, since the
   * listing doesn't exist yet to be boosted) is re-checked and silently trimmed in
   * ListingsService.create(), which never rejects a listing over video. */
  videos?: CreatedVideoInput[];
  /** Category-specific field values from the posting wizard's schema-driven step —
   * maps directly onto the `attributes` JSONB column. */
  attributes?: Record<string, unknown>;
  /** The exact pin dropped on the map at posting time — optional (a "skip the map" path stays
   * possible). Never returned as-is; see ListingDetailDto.lat/lng for why. */
  lat?: number;
  lng?: number;
}

/** Response from reverse-geocoding a dropped map pin — a suggestion the poster can accept or
 * override, never an auto-locked value (Google's locality boundaries won't line up perfectly
 * with Bhavano's own City/Area curation). `cityId`/`areaId` are null when Google's resolved
 * locality doesn't match any city Bhavano currently supports. */
export interface ReverseGeocodeResultDto {
  cityId?: string;
  areaId?: string;
  formattedAddress: string;
  resolvedLocality: string;
  /** Display name for `cityId` — the poster's initially-fetched city list won't contain a
   * just-created city, so the client needs this to render/select it without a second round trip. */
  cityName?: string;
  /** True when this call just created `cityId` (never existed before) — drives the "we've added
   * this city" note in the posting wizard, instead of silently leaving the seller unsure. */
  isNewCity?: boolean;
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
  /** True when the other party is the inquirer (not this listing's owner) and holds an active
   * buyerPremium subscription — shown as a "✓ Verified Buyer" badge so sellers notice it. */
  otherPartyIsVerifiedBuyer: boolean;
  lastMessage: MessageDto | null;
  unreadCount: number;
}

/** Just enough of a listing to link to it — the same fields `buildListingPath` takes, so a
 * caller can build the URL without refetching the listing itself. Field names match
 * `ListingCardDto` deliberately: the two are interchangeable at that call site. */
export interface ConversationListingRefDto {
  id: string;
  title: string;
  slug: string;
  category: ListingCategory;
  transactionType: TransactionType;
  cityName: string;
  area: string;
}

/** One conversation's own context, for the thread view. The messages come from
 * `/conversations/:id/messages` separately; this is what the page frames them with — chiefly a
 * way back to the listing the thread is about, which is otherwise a dead end for anyone who
 * arrived from "Contact owner" rather than from the messages list. */
export interface ConversationDetailDto {
  id: string;
  type: ConversationType;
  otherPartyName: string;
  listing: ConversationListingRefDto;
}

/** Total unread messages across every conversation the caller is a participant in (either role),
 * for the count badge on the Messages entry point. Returned by `GET /conversations/unread-count`. */
export interface UnreadCountDto {
  count: number;
}

/** Pushed to the per-user socket room (`user:<id>`) whenever the caller's unread total changes —
 * a new message arrived, or they read one (possibly on another device). `unreadCount` is the
 * fresh total, so a client sets the badge to it directly rather than re-fetching. */
export interface UnreadUpdateEvent {
  conversationId: string;
  unreadCount: number;
}

/** Registers/removes an Expo push token for the current device. Sent by the mobile app on login
 * and cleared on logout — see `POST`/`DELETE /me/push-tokens`. */
export interface PushTokenInput {
  token: string;
  platform: "ios" | "android";
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
  /** True only on the login that first creates/welcomes this user — for signup-conversion
   * tracking, not meant as a general-purpose "new account" flag past that one login. */
  isNewUser?: boolean;
}

export interface UserProfileDto {
  id: string;
  name: string | null;
  email: string | null;
  /** Whether the address was actually proven — set by Google sign-in or the emailed-code flow.
   * An email typed into the profile form is stored but stays unverified, and account adoption
   * on Google sign-in keys on this rather than on `email`. See
   * docs/plans/account-linking-phone-and-email.md. */
  emailVerified: boolean;
  phone: string | null;
  cityId: string | null;
  cityName: string | null;
  state: string | null;
  /** ISO timestamp, null if never subscribed or lapsed — see User.premiumUntil/agentProUntil. */
  premiumUntil: string | null;
  agentProUntil: string | null;
  sellerSlotPackUntil: string | null;
  agentProUnits: number;
  activeListingCount: number;
  listingSlotAllowance: number;
}

export interface UpdateProfileInput {
  name?: string;
  cityId?: string;
  /* No `email` here on purpose: an address may only reach the profile through the verified
   * flow (POST /users/me/email/request-code then /email/verify), exactly as a phone may only
   * arrive through OTP. Letting this endpoint set an unverified address is what made account
   * adoption unsafe — see docs/plans/account-linking-phone-and-email.md. */
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

/** One browser session's worth of acquisition data — see the BFF's `Visit` model. `userId` isn't
 * included here since these are always fetched already scoped to one user. */
export interface VisitDto {
  id: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPath: string | null;
  /** Best-effort city/region/country guess from the visit's IP, via a local MaxMind lookup —
   * see docs/plans/visit-ip-city-logging.md. Approximate; not a verified location. */
  ipCity: string | null;
  ipRegion: string | null;
  ipCountry: string | null;
  createdAt: string;
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
    /** First-touch attribution — how this user originally found Bhavano. Null for pre-existing
     * users whose signup predates this being captured. */
    acquisitionSource: string | null;
    acquisitionMedium: string | null;
    acquisitionCampaign: string | null;
  };
  events: ActivityEventDto[];
  /** Recent browsing sessions (not page loads) for this user, newest first — includes sessions
   * from before they ever signed up/logged in, once linked. */
  visits: VisitDto[];
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
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  amount: number;
  currency: string;
  /** Agent Pro monthly credit — boost applied server-side, no Razorpay checkout. */
  activated?: boolean;
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

export interface CreateSubscriptionOrderInput {
  tier: SubscriptionTier;
  /** buyerPremium: 1, 6, or 12; sellerSlotPack and agentPro: 1 month only. */
  months: number;
  /** agentPro only — each unit is 20 slots at ₹499 (default 1). */
  agentProUnits?: number;
}

/** Same shape as CreateBoostOrderResponseDto — kept as its own named type since callers read
 * more clearly as "a subscription order", not "a boost order". */
export interface CreateSubscriptionOrderResponseDto {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

/** A public, unauthenticated storefront for any user with active listings — Agent Pro
 * subscribers additionally get the "isAgentPro" badge shown on it. */
export interface AgentStorefrontDto {
  id: string;
  name: string;
  isAgentPro: boolean;
  memberSince: string;
  listings: ListingCardDto[];
  total: number;
}

/** Bhavano Plus's early-access alerts — Plus-gated (see SavedSearchesService). All filter
 * fields undefined means "don't filter on this dimension", not "must be empty". */
export interface SavedSearchDto {
  id: string;
  name: string;
  category?: ListingCategory;
  transactionType?: TransactionType;
  cityId?: string;
  cityName?: string;
  areaId?: string;
  areaName?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  createdAt: string;
}

export interface CreateSavedSearchInput {
  name: string;
  category?: ListingCategory;
  transactionType?: TransactionType;
  cityId?: string;
  areaId?: string;
  /** A typed area name not found in the existing list — resolved (case-insensitive match, or
   * created) the same way posting a new ad does. Ignored if areaId is also set. */
  areaName?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}

// ---------------------------------------------------------------------------
// Outreach / marketing campaigns — see docs/plans/outreach-campaign-contacts.md
// ---------------------------------------------------------------------------

export type ContactSource = "google_maps" | "scrape" | "manual_upload" | "referral";
export type ContactStatus = "new" | "enriched" | "contacted" | "engaged" | "converted" | "invalid" | "bounced";
export type ConsentState = "none" | "implied" | "explicit" | "opted_out";
export type OutreachChannel = "sms" | "whatsapp" | "email";
export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed";
export type SendStatus = "queued" | "sent" | "delivered" | "failed" | "suppressed" | "opted_out";

export interface OutreachContactDto {
  id: string;
  name: string;
  phone: string | null;
  phoneE164: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  cityId: string | null;
  cityName: string | null;
  areaName: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleRatingAt: string | null;
  googlePlaceId: string | null;
  businessCategory: string | null;
  website: string | null;
  source: ContactSource;
  sourceRef: string | null;
  status: ContactStatus;
  tags: string[];
  notes: string | null;
  consentState: ConsentState;
  /** Null until the contact has been messaged at least once. */
  lastContactedAt: string | null;
  contactedCount: number;
  /** Set once this prospect signed up — outreach → real-user attribution. */
  userId: string | null;
  createdAt: string;
}

export interface OutreachContactsPage {
  items: OutreachContactDto[];
  nextCursor: string | null;
  total: number;
}

/** Audience is a filter, not a frozen list, so a recurring campaign picks up contacts imported
 * after it was created. Every field is optional — an empty filter matches every contact. */
export interface CampaignAudienceFilter {
  cityIds?: string[];
  businessCategories?: string[];
  tags?: string[];
  /** Google rating floor, e.g. 4 — excludes unrated contacts when set. */
  minRating?: number;
  statuses?: ContactStatus[];
}

export interface OutreachCampaignDto {
  id: string;
  name: string;
  channel: OutreachChannel;
  status: CampaignStatus;
  bodyTemplate: string;
  subject: string | null;
  dltTemplateId: string | null;
  audienceFilter: CampaignAudienceFilter;
  cadenceCron: string | null;
  scheduledAt: string | null;
  lastRunAt: string | null;
  maxSendsPerRun: number;
  minDaysBetweenSends: number;
  dryRun: boolean;
  createdAt: string;
  /** Per-status send tallies across every run of this campaign. */
  stats: Record<SendStatus, number>;
}

export interface OutreachCampaignsPage {
  items: OutreachCampaignDto[];
  nextCursor: string | null;
  total: number;
}

export interface CampaignSendDto {
  id: string;
  campaignId: string;
  campaignName: string;
  contactId: string;
  contactName: string;
  channel: OutreachChannel;
  status: SendStatus;
  runKey: string;
  renderedBody: string;
  sentAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface CampaignSendsPage {
  items: CampaignSendDto[];
  nextCursor: string | null;
  total: number;
}

export interface CreateOutreachContactInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  lat?: number;
  lng?: number;
  cityId?: string;
  areaId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  googlePlaceId?: string;
  businessCategory?: string;
  website?: string;
  source: ContactSource;
  sourceRef?: string;
  tags?: string[];
  notes?: string;
  consentState?: ConsentState;
  consentSource?: string;
}

export interface ImportOutreachContactsInput {
  source: ContactSource;
  sourceRef?: string;
  contacts: CreateOutreachContactInput[];
}

export interface ImportOutreachContactsResult {
  created: number;
  /** Matched an existing googlePlaceId and were updated in place rather than duplicated. */
  updated: number;
  /** Rejected for having neither a usable phone nor email. */
  skipped: number;
}

export interface CreateOutreachCampaignInput {
  name: string;
  channel: OutreachChannel;
  bodyTemplate: string;
  subject?: string;
  dltTemplateId?: string;
  audienceFilter?: CampaignAudienceFilter;
  cadenceCron?: string;
  scheduledAt?: string;
  maxSendsPerRun?: number;
  minDaysBetweenSends?: number;
  dryRun?: boolean;
}

export type UpdateOutreachCampaignInput = Partial<CreateOutreachCampaignInput> & {
  status?: CampaignStatus;
};

/** What a campaign would send right now, without sending it — powers the admin's pre-flight
 * audience preview. */
export interface CampaignPreviewDto {
  /** Contacts matching the audience filter, before eligibility rules. */
  audienceSize: number;
  /** How many would actually be messaged on the next run (after suppression, opt-out,
   * minDaysBetweenSends and maxSendsPerRun). */
  eligibleCount: number;
  suppressedCount: number;
  recentlyContactedCount: number;
  /** A handful of resolved message bodies, so a bad placeholder is caught before sending. */
  sampleBodies: string[];
}

/** What the other account holds, so a merge prompt can itemise what moves rather than asking
 * for a bare confirmation. See docs/plans/account-linking-phone-and-email.md. */
export interface AccountMergeSummary {
  listings: number;
  activeSubscription: boolean;
  payments: number;
  conversations: number;
  favourites: number;
}

/** Outcome of adding an identifier that turned out to belong to another account.
 * - `linked`   — the identifier was free; nothing else happened.
 * - `merged`   — the other account was empty, so it was merged automatically and announced.
 * - `confirm`  — both accounts hold something; the user must approve before anything moves. */
export type LinkIdentifierResult =
  | { status: "linked" }
  | {
      status: "merged";
      /** True when the session's own account was the one retired — its listings now live under
       * the surviving id, so the caller must sign in again rather than keep acting as a row that
       * no longer holds anything. Surfaced here rather than resolved in AuthGuard, which is
       * deliberately DB-free and runs on every authenticated request. */
      reauthRequired: boolean;
    }
  | { status: "confirm"; summary: AccountMergeSummary };
