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

/** How the ad itself was created. "direct" (the owner posted it through the wizard) is the
 * only path that exists today and the default for every row; "manual"/"google_api" are for
 * future admin tooling. Admin-visible only — see ListingDetailDto.source. */
export type ListingSource = "direct" | "manual" | "google_api";

/** Which outreach channel's claim link was actually clicked to complete a listing claim — see
 * Listing.claimSource and ListingsService.claimListing. */
export type ClaimSource = "email" | "whatsapp";

export type UserRole = "user" | "admin";

/** approved = normal/visible; flagged = an admin took it offline pending a fix from the
 * owner — this IS the soft-delete, there's no separate "deleted" state. */
export type ModerationState = "approved" | "flagged";

/** inquiry = buyer/seller chat about a listing; moderation = admin↔owner thread about a
 * flagged listing. Kept distinct so an admin's thread can't collide with a real buyer's. */
export type ConversationType = "inquiry" | "moderation";

export type LoginMethod = "otp" | "google" | "apple";

export type RateLimitKind = "publish" | "view";

/** Internal workflow state for a captured requirement — not a moderation state, since a
 * Requirement is not public content yet. */
export type RequirementStatus = "open" | "working" | "closed";

/** Why a requirement stopped being live. `fulfilled` vs `withdrawn` is the only measure of
 * whether the feature actually works, so they are never collapsed into one "closed". */
export type RequirementClosedReason = "fulfilled" | "withdrawn" | "expired" | "dismissed";

export type ListingSlotUpsell = import("./listingSlots").ListingSlotUpsell;
export type { ListingSlotCapErrorBody } from "./listingSlots";

export type PaymentPurpose =
  | "listing_boost"
  | "buyer_premium"
  | "agent_pro"
  | "seller_slot_pack"
  | "contact_reveal_credits"
  | "instant_alerts";

export type PaymentStatus = "created" | "paid" | "failed" | "refunded";

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
  /** True when `price` reads "Contact for price" rather than a real ₹ amount — pg/coworking
   * only (see ListingsService.assertValidPrice), for a poster whose plans vary by option and
   * hasn't set one yet. Buyer-facing pages use this instead of string-matching `price` to decide
   * whether to render the "reach out for a quote" note or include a price in JSON-LD. */
  priceOnRequest: boolean;
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
  /** True while `Listing.instantAlertsUntil` is in the future — drives the owner-only "Instant
   * Alerts active" state on my-listings/the post-ad success screen (never shown to a non-owner).
   * See docs/plans/instant-alerts-paid-message-notifications.md. */
  hasInstantAlerts: boolean;
  /** Whether at least one processed (status "done") video exists — drives a "▶ Video" browse-card
   * badge. Deliberately not the full `videos[]` array here (see ListingDetailDto.videos) since
   * browse pages render 20+ cards and none of them play video. See docs/plans/listing-video-uploads.md. */
  hasVideo: boolean;
  /** The viewer posted this listing. Hides the contact actions on the card, for the same reason
   * as on the detail page — always false for an anonymous viewer, who owns nothing. */
  isOwner: boolean;
  /** Whether the requesting viewer has already unlocked this listing's owner contact — always
   * derived server-side from a real ContactReveal row (see docs/plans/contact-reveal-credits.md),
   * never a cached flag. `ownerPhone`/`ownerEmail` are only ever populated when this is true; the
   * raw JSON response never carries them otherwise, so there's nothing to hide client-side.
   * Present on both the browse-card and detail responses so "View Contact" works from either. */
  contactRevealed: boolean;
  ownerPhone: string | null;
  ownerEmail: string | null;
  /** Only meaningful when `contactRevealed` is false — what unlocking would cost this viewer,
   * so the "View Contact" button can show the right label without a second round trip.
   * Undefined for an anonymous viewer (not logged in yet). */
  revealMethod?: "free" | "credit" | "insufficient";
  /** The current admin-configured credit pack, inlined here (rather than a separate settings
   * fetch) so the purchase sheet can render off this same response — present whenever
   * `revealMethod` is `"credit"` or `"insufficient"`. */
  creditPackSize?: number;
  creditPackPriceRupees?: number;
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
  /** listingPhotos.rotation for each entry, same order as `photosFull` — the current manual
   * correction in degrees. NOT used for cache-busting (see photoUpdatedAts) — it cycles
   * (0/90/180/270/0/…), so reusing it as a query param would collide with an already-cached
   * request from before the photo was ever rotated once the cycle wraps back to 0. */
  photoRotations: number[];
  /** listingPhotos.updatedAt (as epoch ms) for each entry, same order as `photosFull` — the admin
   * UI appends this to the image URL as a cache-busting query param. Variant keys never change
   * (see apps/bff/src/uploads/photo-keys.ts) even after a rotate, only their bytes do, and unlike
   * `rotation` this value is never reused, so a browser or CDN that already cached the old bytes
   * at that URL can never mistake a fresh rotation for one it's already seen. */
  photoUpdatedAts: number[];
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
  /** The listing's real city/area ids (not just the display `cityName`/`area` name strings from
   * `ListingCardDto`) — not sensitive, just never previously needed outside the admin edit form
   * that lets an admin re-pick them. See docs/plans/admin-edit-location-and-category.md. */
  cityId: string;
  areaId: string;
  /** Unjittered — only present for the owner or an admin, same gating as `videoEntitlement`/
   * `renewalHistory`. The seller's exact dropped pin, for the admin edit form to pre-fill; the
   * public `lat`/`lng` above stay jittered for everyone including the owner/admin. Undefined if
   * no pin was ever dropped at posting time. */
  exactLat?: number;
  exactLng?: number;
  /** Whether the "your ad is live" acknowledgement (email or WhatsApp) was confirmed sent —
   * derived from a real ListingNotificationLog row, never a dispatch-attempted flag (same
   * precedent as User.welcomed). Only populated in the admin moderation queue
   * (ListingsService.listForAdmin); every other listing response leaves these undefined rather
   * than paying for the extra query. */
  postedNotificationSent?: boolean;
  postedNotificationChannel?: string | null;
  postedNotificationSentAt?: string | null;
  /** WhatsApp-only — "delivered"/"read"/"failed" from MSG91's status webhook (see
   * WhatsappWebhookController), advanced asynchronously after the send itself. Null until the
   * first status event arrives, and stays null forever for an email send (no such signal exists
   * there) or a WhatsApp send from before this tracking existed. */
  postedNotificationDeliveryStatus?: string | null;
  /** Buyer-inquiry (`type: "inquiry"`) conversation count — never counts the admin↔owner
   * moderation thread. Only populated in the admin moderation queue (ListingsService.listForAdmin),
   * same precedent as postedNotificationSent above. */
  messageCount?: number;
  /** direct / manual / google_api — never populated outside the admin moderation queue
   * (ListingsService.listForAdmin), same precedent as messageCount above. */
  source?: ListingSource;
  /** email / whatsapp — which outreach channel's claim link the owner actually clicked, for the
   * admin claim-rate-by-channel breakdown. Undefined for a never-claimed listing; same
   * admin-moderation-queue-only precedent as source above. */
  claimSource?: ClaimSource | null;
}

export interface ListingRenewalDto {
  from: string;
  to: string;
  renewedAt: string;
}

/** Just what a listing page's `generateMetadata` needs (title/description/canonical-path/OG
 * image) — deliberately not the full ListingDetailDto. That fetch runs a second time
 * independent of the page component's own full fetch (React's `cache()` does not dedupe across
 * generateMetadata and the page component in Next's App Router — confirmed empirically, see
 * apps/web/src/lib/bff.ts's fetchListingById), so this exists to make the unavoidable second
 * call cheap (no attributes/videos/reveal-state joins) rather than free. Public/anonymous only —
 * nothing here is viewer-dependent, unlike ListingDetailDto's contactRevealed/isOwner/etc. */
export interface ListingMetaDto {
  id: string;
  slug: string;
  category: ListingCategory;
  transactionType: TransactionType;
  cityName: string;
  area: string;
  title: string;
  price: string;
  priceQualifier: string;
  priceOnRequest: boolean;
  description: string | null;
  specs: string[];
  /** Full-size CDN URL of the first photo, or null if the listing has none yet. */
  ogImage: string | null;
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

/** Admin-only superset of `UpdateListingInput` — fields an admin can additionally change from the
 * admin listing edit form that an owner cannot self-edit (category/transactionType/city/area/map
 * pin). `areaId`/`areaName` are mutually exclusive, same as `CreateListingInput` — `areaName` goes
 * through the same find-or-create `ensureArea` resolution creation does. See
 * docs/plans/admin-edit-location-and-category.md. */
export interface AdminUpdateListingInput extends UpdateListingInput {
  category?: ListingCategory;
  transactionType?: TransactionType;
  cityId?: string;
  areaId?: string;
  areaName?: string;
  lat?: number;
  lng?: number;
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
  /** Links this listing to the OutreachContact it was bulk-imported from — bulk_upload_listings.py
   * only, never set by the normal posting wizard. See ListingsService.claimListing. */
  claimContactId?: string;
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

/** One Google Places Autocomplete suggestion — `GET /locations/place-autocomplete`. `placeId`
 * is opaque to the caller; it only ever gets passed back to `POST /locations/place-details` to
 * resolve into coordinates. */
export interface PlaceAutocompletePrediction {
  placeId: string;
  description: string;
}

/** `POST /locations/place-details`'s response — a `ReverseGeocodeResultDto` (same City/Area
 * resolution `reverseGeocodeGoogle` already does for a dropped pin) plus the coordinates Place
 * Details resolved, since the caller doesn't have those yet the way a pin-drop caller already
 * does. */
export interface PlaceGeocodeResultDto extends ReverseGeocodeResultDto {
  lat: number;
  lng: number;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  /** Null once `deletedAt` is set — the original text never ships to clients past that point. */
  body: string | null;
  createdAt: string;
  readAt: string | null;
  deletedAt: string | null;
}

export interface MessageDeletedEvent {
  messageId: string;
  conversationId: string;
  deletedAt: string;
}

export interface SendFirstMessageResponseDto {
  conversationId: string;
  message: MessageDto;
}

export interface ConversationSummaryDto {
  id: string;
  listingId: string;
  listingTitle: string;
  listingArea: string;
  listingCityName: string;
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

/** Whether to show the deferred profile-completion dialog and what it should ask for. Computed
 * BFF-side (it owns the snooze/count fields and profile completeness) so the answer is the same
 * on every device — see docs/plans/profile-completion-dialog.md. `show` already folds in the
 * per-user snooze window and the lifetime cap; the client additionally gates it on a *return*
 * login (`!session.isNewUser`). */
export interface ProfileNudgeDto {
  show: boolean;
  missing: ("email" | "phone")[];
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
  total: number;
}

/** One row of a listing's "Liked & Viewed" admin table — a `Favourite` or a logged-in-viewer
 * `ListingView` row, resolved to the real user. Anonymous views are never rows here (no
 * resolvable user) — see ListingsService.listEngagement for why. The same user can appear twice
 * (once per action) if they both liked and viewed. */
export interface ListingEngagementRowDto {
  userId: string;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  action: 'liked' | 'viewed';
  at: string;
}

export interface ListingEngagementPage {
  items: ListingEngagementRowDto[];
  total: number;
}

/** One row of a listing's admin "Messages" table — a buyer-inquiry conversation (never the
 * admin↔owner moderation thread, which shares the same listingId under a different `type`). */
export interface AdminConversationSummaryDto {
  id: string;
  inquirer: { id: string; name: string | null; phone: string | null; email: string | null };
  lastMessage: MessageDto | null;
  /** The last message was the buyer's and the owner hasn't read it yet — an admin triage signal,
   * not a per-viewer unread count (the admin isn't a participant in this conversation). */
  unreadByOwner: boolean;
  createdAt: string;
}

export interface AdminConversationsPage {
  items: AdminConversationSummaryDto[];
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
  total: number;
}

/** One `Visit` row (one browser session) flattened for the admin page-visits screen — the user
 * fields are joined in so a session that later signed in shows who it was. `ipCity`/`ipRegion`/
 * `ipCountry` are the best-effort GeoIP guess stored at write time, never a `City` FK. */
/** Mirrors the BFF's DEVICE_TYPES (apps/bff/src/analytics/device-type.ts). */
export type DeviceType = "desktop" | "mobile" | "tablet" | "mobile_app";

export interface PageVisitDto {
  id: string;
  /** The session cookie id (`bhavano_sid`) — also how `PageView` rows are keyed, so this is what
   * the admin page-visits screen links through to fetch a session's full page-view trail. */
  sessionId: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  campaignId?: string;
  adGroupId?: string;
  campaignName?: string;
  adGroupName?: string;
  landingPath: string | null;
  ip: string | null;
  ipCity: string | null;
  ipRegion: string | null;
  ipCountry: string | null;
  /** Null only for rows written before this field existed. */
  deviceType: DeviceType | null;
  /** When a real browser engine confirmed it executed JavaScript on this session — see
   * `Visit.jsConfirmedAt`. Null covers "never confirmed" without distinguishing why (pre-dates
   * the column, JS never ran, or the beacon didn't land), so treat it as "unconfirmed", never as
   * "not a human". Unlike `deviceType` and the crawler flag, this isn't derived from a header the
   * client chose for itself, which makes it the strongest human signal on this screen. */
  jsConfirmedAt: string | null;
  /** Count of `PageView` rows logged for this session — see PageView's schema comment for the
   * "best effort, not literally every navigation" caveat behind this number. */
  pageViewCount: number;
  /** Every account that logged in during this session, from `LoginEvent.sessionId` — not just
   * the one on `userId` above, which can only ever hold whoever logged in *first*.
   *
   * A session genuinely can see several: a shared desktop, or one person signing up by phone and
   * then by Google seconds later (which creates two accounts — see
   * docs/plans/account-linking-phone-and-email.md). Before this, the second account was simply
   * absent from this screen. More than one entry here is also the duplicate-account signal that
   * merge flow needs. Empty for a session nobody logged in during, and for sessions that predate
   * LoginEvent.sessionId. */
  sessionLogins: PageVisitSessionLogin[];
}

export interface PageVisitSessionLogin {
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  method: LoginMethod;
  createdAt: string;
}

export interface PageVisitsPage {
  items: PageVisitDto[];
  total: number;
  /** Average `pageViewCount` per session honouring the current date range and crawler filter,
   * and nothing else — null when there are no matching sessions to average. The other text
   * filters are deliberately excluded: PageView rows carry just `sessionId`/`path`/`createdAt`,
   * so honouring each one would mean re-deriving the whole matching session set per filter. The
   * crawler filter is the one exception because it has to be — a crawler is one page view per
   * session by construction (they discard cookies, so every request is a new session), so
   * including them pins this number at ~1.0 and makes it meaningless. */
  avgPageViewsPerSession: number | null;
}

/** One page view within a session's trail — see the BFF's `PageView` model. */
export interface PageViewDto {
  path: string;
  createdAt: string;
}

/** A session's full page-view trail plus the same summary `page-visits` shows for its one Visit
 * row, for the admin drill-down screen. */
export interface SessionTrailDto {
  visit: PageVisitDto;
  pageViews: PageViewDto[];
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
  /** Links to the same page-view trail the admin page-visits screen exposes — see
   * `PageVisitDto.sessionId`. */
  sessionId: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPath: string | null;
  /** Best-effort city/region/country guess from the visit's IP, via a local MaxMind lookup —
   * see docs/plans/visit-ip-city-logging.md. Approximate; not a verified location. */
  ipCity: string | null;
  ipRegion: string | null;
  ipCountry: string | null;
  deviceType: DeviceType | null;
  createdAt: string;
  pageViewCount: number;
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

/** One row of the admin users list — `welcomed`/`welcomedChannel`/`welcomedAt` are derived from
 * an actual `UserNotificationLog` row (`kind: "welcome"`), not from `User.welcomedAt`, since that
 * flag is set unconditionally as a dispatch-attempted marker and can be true even when the send
 * itself failed. */
export interface UserSummaryDto {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  cityName: string | null;
  createdAt: string;
  welcomed: boolean;
  welcomedChannel: string | null;
  welcomedAt: string | null;
}

export interface AdminUsersPage {
  items: UserSummaryDto[];
  total: number;
}

export type WelcomeChannel = "email" | "whatsapp";

export interface SendWelcomeInput {
  userIds: string[];
  channel: WelcomeChannel;
}

export interface SendWelcomeResultDto {
  userId: string;
  success: boolean;
  /** e.g. "No email on file", "Send failed" — shown inline per user in the admin UI. */
  error?: string;
}

export interface SendWelcomeResponseDto {
  sent: number;
  failed: number;
  results: SendWelcomeResultDto[];
}

export interface SendPostedNotificationInput {
  listingIds: string[];
}

export interface SendPostedNotificationResultDto {
  listingId: string;
  success: boolean;
  /** e.g. "Already sent", "Owner has no email or phone on file" — shown inline per listing in
   * the admin UI. */
  error?: string;
}

export interface SendPostedNotificationResponseDto {
  sent: number;
  failed: number;
  results: SendPostedNotificationResultDto[];
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

/** One priceable option in `BoostPricingPreviewDto` — rupees, already discounted (never paise;
 * this is for display only, not a Razorpay order amount). `free` covers the Agent Pro monthly
 * boost credit, in which case `amount`/`originalAmount` are both 0 and `discountApplied` is
 * always false (a discount code on top of an already-free boost has nothing to apply to). */
export interface BoostPricingOptionDto {
  amount: number;
  originalAmount: number;
  discountApplied: boolean;
  free: boolean;
}

/** Live pricing for the post-ad success screen's Boost/Instant Alerts picker — one call, every
 * option's final price (any auto-applied discount code and the free Agent Pro credit both
 * already resolved), so the screen never shows a price before knowing what it actually is. See
 * PaymentsService.previewBoostPricing. */
export interface BoostPricingPreviewDto {
  boost7: BoostPricingOptionDto;
  boost15: BoostPricingOptionDto;
  boost7WithInstantAlerts: BoostPricingOptionDto;
  boost15WithInstantAlerts: BoostPricingOptionDto;
}


/** One field's before/after value in a ListingEditLogEntryDto's `changes` — values are
 * `unknown` because different actions touch completely different field types (a number for
 * price, a string for status, an object for attributes). */
export interface ListingFieldChange {
  before: unknown;
  after: unknown;
}

/** admin/listings/[id]'s History tab — one row per ListingsService/AdminService mutation to a
 * listing. `actorType`/`actorId`/`actorName` describe who did it (a real User for 'owner' and
 * 'admin', null for 'system'); `changes` is null only for 'created', which has no "before". */
export interface ListingEditLogEntryDto {
  id: string;
  actorType: "owner" | "admin" | "system";
  actorId: string | null;
  actorName: string | null;
  action: string;
  changes: Record<string, ListingFieldChange> | null;
  createdAt: string;
}

export interface ListingEditLogPage {
  items: ListingEditLogEntryDto[];
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

export interface RevealContactResponseDto {
  ownerPhone: string | null;
  ownerEmail: string | null;
}

/** Admin-editable contact-reveal settings — same singleton-row convention as
 * RateLimitSettingsDto. See docs/plans/contact-reveal-credits.md. */
export interface ContactRevealSettingsDto {
  freeRevealsPerUser: number;
  creditPackSize: number;
  creditPackPriceRupees: number;
  creditExpiryMonths: number;
}

export type UpdateContactRevealSettingsInput = ContactRevealSettingsDto;

/** A user's own current standing — free reveals left this account has never used, plus the sum
 * of `creditsRemaining` across every non-expired purchased batch. Derived fresh from
 * ContactReveal/ContactRevealCreditBatch rows on every request (ContactRevealService.
 * getBalanceForUser), never a cached counter — same "trust the log, not a flag" convention as
 * everything else in this feature. `nextCreditExpiryAt` is the earliest expiry among batches
 * that still have credits left, so the UI can warn before credits lapse unused; null when there's
 * nothing to expire (no batches, or all already spent/expired). */
export interface ContactRevealBalanceDto {
  freeRevealsRemaining: number;
  creditsRemaining: number;
  nextCreditExpiryAt: string | null;
}

/** One row per `Payment` — every purpose in one feed rather than a separate history per feature,
 * since that's how a user actually thinks of "things I've bought". Purpose-specific fields are
 * all optional and only populated for their own purpose (listingId/listingTitle: listing_boost;
 * boostDays: listing_boost; subscriptionMonths/agentProUnits: buyer_premium/agent_pro/
 * seller_slot_pack; creditPackSize: contact_reveal_credits) — mirrors Payment's own nullable-
 * column-per-purpose convention in schema.prisma. */
export interface PaymentHistoryItemDto {
  id: string;
  purpose: PaymentPurpose;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
  listingId?: string;
  listingTitle?: string;
  boostDays?: number;
  subscriptionMonths?: number;
  agentProUnits?: number;
  creditPackSize?: number;
}

export interface PaymentHistoryPage {
  items: PaymentHistoryItemDto[];
  nextCursor: string | null;
}

/** Admin's unified purchases view — every `Payment` regardless of purpose, replacing what used to
 * be a boosts-only list. Same purpose-specific-optional-fields convention as
 * `PaymentHistoryItemDto`, plus what only an admin needs: who bought it (`userId`/`userName`/
 * `userPhone`/`userEmail`) and when whatever it activated expires. `expiresAt` is resolved
 * server-side from whichever of `ListingBoost.boostedUntil`/`ListingInstantAlert.activeUntil`/
 * `UserSubscription.endsAt`/`ContactRevealCreditBatch.expiresAt` this payment's purpose actually
 * created — never a column on Payment itself, so (see AdminService.listPayments) it can't be
 * sorted on without a raw-SQL join across four tables, the same reason PageVisitDto.pageViewCount
 * isn't sortable either. */
export interface AdminPaymentDto {
  id: string;
  purpose: PaymentPurpose;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  userEmail: string | null;
  listingId?: string;
  listingTitle?: string;
  boostDays?: number;
  boostIncludesInstantAlerts?: boolean;
  subscriptionMonths?: number;
  agentProUnits?: number;
  creditPackSize?: number;
  /** The code actually applied at order-creation, if any — not every discount code redemption
   * necessarily reached `paid` (see DiscountCodeRedemption's own doc comment), but this reflects
   * what the buyer entered regardless of outcome. */
  discountCode?: string;
}

export interface AdminPaymentsPage {
  items: AdminPaymentDto[];
  total: number;
}

/** Pack size/price are never client-supplied — always read from ContactRevealSetting
 * server-side. `discountCode` is optional, validated server-side against DiscountCode. */
export interface CreateContactRevealCreditsOrderInput {
  discountCode?: string;
}

/** Same shape as CreateBoostOrderResponseDto/CreateSubscriptionOrderResponseDto — its own named
 * type for the same reason CreateSubscriptionOrderResponseDto is. */
export interface CreateContactRevealCreditsOrderResponseDto {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

/** No seller-chosen duration (unlike boostDays) — Instant Alerts always runs until the listing's
 * own expiresAt, resolved server-side at activation time. discountCode is optional, same as
 * every other order-creation input here. */
export interface CreateInstantAlertsOrderInput {
  listingId: string;
  discountCode?: string;
}

/** Same shape as CreateBoostOrderResponseDto/CreateContactRevealCreditsOrderResponseDto — its
 * own named type for the same reason CreateSubscriptionOrderResponseDto is. */
export interface CreateInstantAlertsOrderResponseDto {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

/** Admin-managed coupon — not tied to a referring user — redeemable across every paid purpose. */
export interface DiscountCodeDto {
  id: string;
  code: string;
  discountPercent: number;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  redemptionCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateDiscountCodeInput {
  code: string;
  discountPercent: number;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  expiresAt?: string;
}

export interface AdminDiscountCodesPage {
  items: DiscountCodeDto[];
  total: number;
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

/** A seeker's unmet demand, captured from an empty search — Phase 0 of
 * docs/plans/property-requirements-demand-side.md. Internal for now: read by the seeker on
 * /my-requirements and by an admin who works it by hand. */
export interface RequirementDto {
  id: string;
  /** How the search was described to the seeker, e.g. "2 BHK apartments for rent in Koramangala,
   * Bengaluru" — stored verbatim so it still reads correctly months later. */
  searchLabel: string;
  category?: ListingCategory;
  transactionType?: TransactionType;
  cityId?: string;
  cityName?: string;
  areaId?: string;
  areaName?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  landingPath?: string;
  /** The seeker's own words, when they added any — absent for a one-tap capture. */
  note?: string;
  moveInBy?: string;
  status: RequirementStatus;
  closedReason?: RequirementClosedReason;
  expiresAt: string;
  /** Derived from `expiresAt` on every read, like ListingDetailDto.isExpired — a row can be past
   * its date for hours before any job gets to it, and every reader needs the same answer. */
  isExpired: boolean;
  /** Whether an alert was created alongside — false when the seeker had used up their free
   * allowance, in which case nothing notifies them automatically and the follow-up is manual. */
  hasAlert: boolean;
  /** Whether the seeker agreed that owners and agents with a matching property may contact them
   * directly. False means only Bhavano gets in touch. */
  contactConsent: boolean;
  createdAt: string;
}

/** Admin view of a captured requirement — adds the seeker and the follow-up state that the
 * seeker's own view has no business seeing. */
export interface AdminRequirementDto extends RequirementDto {
  seekerId: string;
  seekerName: string | null;
  seekerPhone: string | null;
  seekerEmail: string | null;
  adminNote?: string;
  updatedAt: string;
}

export interface AdminRequirementsPage {
  items: AdminRequirementDto[];
  total: number;
  /** Count of `open` rows regardless of the current filter — the number that says whether
   * anybody is actually working the queue. */
  openTotal: number;
}

/** One row of the admin "what people search for" screen — an aggregate, not individual searches,
 * because the actionable question is "which area and category do people keep asking for", not
 * "what did session X do". */
export interface SearchDemandRowDto {
  cityName: string | null;
  areaName: string | null;
  category?: ListingCategory;
  transactionType?: TransactionType;
  searches: number;
  /** How many of those searches returned nothing — the inventory gap. */
  emptySearches: number;
  /** Average results across those searches, so "thin" is distinguishable from "empty". */
  avgResults: number;
  lastSearchedAt: string;
}

export interface SearchDemandPage {
  rows: SearchDemandRowDto[];
  /** Totals across the whole window, unaffected by the row cap. */
  totalSearches: number;
  totalEmptySearches: number;
  /** The most-typed search text, which no aggregate on criteria alone can show. */
  topQueries: { q: string; searches: number; emptySearches: number }[];
}

export interface SavedSearchSettingsDto {
  freeAlertsPerUser: number;
}

export type UpdateSavedSearchSettingsInput = SavedSearchSettingsDto;

/** What an owner is shown about demand matching their own inventory — deliberately carries no
 * seeker identity at all. The contact path is the plan's messaging-first flow, not this. */
export interface OwnerRequirementMatchDto {
  id: string;
  searchLabel: string;
  cityName?: string;
  areaName?: string;
  category?: ListingCategory;
  transactionType?: TransactionType;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  note?: string;
  moveInBy?: string;
  createdAt: string;
}

export interface UpdateMyRequirementInput {
  note?: string;
  moveInBy?: string;
}

export interface CreateRequirementInput {
  searchLabel: string;
  note?: string;
  moveInBy?: string;
  category?: ListingCategory;
  transactionType?: TransactionType;
  cityId?: string;
  areaId?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  landingPath?: string;
  /** The seeker's answer to "may owners and agents with a match contact you directly?" — asked
   * on the capture card itself, since it is the one thing about a requirement that cannot be
   * inferred from the search. Absent is treated as no. */
  contactConsent?: boolean;
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
  /** Google's OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY. Null means unknown (a
   * pre-migration row, or a non-Maps source) — treated as "don't block," not "known good." */
  businessStatus: string | null;
  website: string | null;
  /** The exact scrape run this contact came from — see PlacesFetchLog. Null for anything not
   * from get_pg_coworking_leads.py (manual/CSV imports). */
  placesFetchLogId: string | null;
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
  /** True only when this contact has a linked-but-unclaimed listing (claimContactId) — i.e. it's
   * actually eligible for POST .../send-claim-verification right now. False both when no listing
   * was ever created against this contact, and when one was but has already been claimed — the
   * admin UI's bulk "send claim verification" action uses this to decide what's selectable. */
  hasClaimableListing: boolean;
  /** True as soon as any listing is linked (claimContactId), claimed or not — the complement of
   * this is what the admin UI's "create listing directly" action (createListingFromContact) is
   * offered for, since Listing.claimContactId is unique: at most one listing per contact ever. */
  hasListing: boolean;
  /** Which channel's claim link was actually clicked — set only once the listing is genuinely
   * claimed (mirrors Listing.claimSource, which is null both before a claim and, rarely, on a
   * claim reached without a ?via= param). This is the one place a notification's *success* is
   * provable today: a claim proves that specific send was delivered and acted on. There's no
   * equivalent "failed" signal — a send that was delivered but ignored and a send that silently
   * failed both just look like "sent, not yet claimed" (contactedCount > 0, this still null). */
  claimedViaChannel: ClaimSource | null;
}

export interface OutreachContactsPage {
  items: OutreachContactDto[];
  total: number;
}

/** One row per Google Places search get_pg_coworking_leads.py has actually run — see
 * PlacesFetchLog in schema.prisma. A log, not a cache: the same (city, area, category) combo can
 * have more than one row if it was ever re-searched with --force. */
export interface PlacesFetchLogEntryDto {
  id: string;
  citySearched: string;
  cityId: string | null;
  areaSearched: string | null;
  areaId: string | null;
  businessCategory: string;
  /** The search term used — "PG accommodation" (category default) or a custom one via
   * get_pg_coworking_leads.py's --query-prefix, e.g. "Gents PG" / "Ladies PG" / "Coliving PG".
   * Stored separately from `query`, which has city/area already baked in. */
  queryPrefix: string;
  query: string;
  resultsFound: number;
  resultsImported: number;
  minRatingFilter: number | null;
  fetchedAt: string;
}

/** Created *before* the actual Text Search runs, specifically so its id exists in time to be
 * threaded onto each contact that search produces (OutreachContact.placesFetchLogId) — counts
 * aren't known yet at this point, hence no resultsFound/resultsImported here; see
 * UpdatePlacesFetchLogCountsInput for the follow-up patch once they are. */
export interface CreatePlacesFetchLogInput {
  citySearched: string;
  cityId?: string;
  areaSearched?: string;
  areaId?: string;
  businessCategory: string;
  queryPrefix: string;
  query: string;
  minRatingFilter?: number;
}

export interface UpdatePlacesFetchLogCountsInput {
  resultsFound: number;
  resultsImported: number;
}

/** One (areaId|null, businessCategory) pair per already-searched combo for a city — what
 * get_pg_coworking_leads.py checks before querying, replacing the old fetched_state.json file.
 * areaSearched/query/counts aren't needed for this check, just "has this combo been done at
 * all" — a lighter response than the full log for a city with a long history. */
export interface FetchedPairDto {
  areaId: string | null;
  businessCategory: string;
  queryPrefix: string;
}

export interface PlacesFetchLogPage {
  items: PlacesFetchLogEntryDto[];
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

/** One row per channel attempted for a claim-verification send — ListingNotificationLog with
 * kind: "claim_verification", surfaced for the admin contacts page's "History" link (the same
 * link CampaignSend-backed campaign sends already use, extended to show this too — see
 * apps/admin/src/app/outreach/sends/page.tsx). Unlike CampaignSend, there's no separate
 * `failed`/`sent`/`delivered` enum here: `deliveryStatus` starts null (sent, nothing further
 * known) or "failed" (the provider call itself errored, set immediately at write time), and for
 * WhatsApp only, WhatsappWebhookController advances it to "delivered"/"read" as MSG91 reports
 * status — email has no equivalent webhook, so its deliveryStatus never moves past its initial
 * value. */
export interface ClaimVerificationSendDto {
  id: string;
  channel: string;
  sentAt: string;
  providerMessageId: string | null;
  deliveryStatus: string | null;
  deliveryStatusAt: string | null;
}

export interface CampaignSendsPage {
  items: CampaignSendDto[];
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
  businessStatus?: string;
  website?: string;
  placesFetchLogId?: string;
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
