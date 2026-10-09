import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminListingRowDto,
  AdminListingsPage,
  AssistedListingInfoDto,
  ClaimSource,
  ListingClaimPreviewDto,
  CreateListingInput,
  CreatedVideoInput,
  HomeCategoryFilter,
  ListingCardDto,
  SellerType,
  ListingCategory,
  ListingDetailDto,
  ListingEditLogEntryDto,
  ListingEditLogPage,
  ListingEngagementPage,
  ListingEngagementRowDto,
  ListingInterestDto,
  ListingInterestPage,
  ListingMetaDto,
  ListingSitemapEntry,
  ListingTotalPriceDto,
  ListingStatus,
  ListingVideoDto,
  ListingsPage,
  RecordListingInterestResponseDto,
  SellerAttentionDto,
  PopularSearchDto,
  PropertyTypeFilter,
  TransactionType,
  UserRole,
} from '@bhavano/types';
import { LISTING_RENEW_ATTENTION_WINDOW_DAYS } from '@bhavano/types/listingLimits';
import { categoryImagePlaceholder } from '@bhavano/types/tokens';
import { slugify } from '@bhavano/types/slugify';
import { deriveTag } from '@bhavano/types/listingTag';
import {
  brokerageFeeIssue,
  CATEGORY_FIELD_CONFIG,
  defaultAttributesFor,
  fieldIsVisible,
  normalizeBrokerageAttributes,
  numberFieldIssue,
  type FieldDef,
} from '@bhavano/types/categoryFields';
import { deriveCardSpecs } from '@bhavano/types/cardSpecs';
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from '@bhavano/types/priceQualifiers';
import { areaUnitShortLabel, type AreaUnit } from '@bhavano/types/areaUnit';
import { formatInrInWords, perUnitTotalPrice } from '@bhavano/types/priceWords';
import { listingPriceIssue } from '@bhavano/types/priceBounds';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import { resolveVideoEntitlement } from '@bhavano/types/videoLimits';
import { MAX_PHOTOS, MIN_PHOTOS } from '@bhavano/types/photoLimits';
import type { DuplicatePhotoErrorBody } from '@bhavano/types/duplicatePhoto';
import { PrismaService } from '../prisma/prisma.service';
import { toE164India } from '../outreach/phone';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReferralsService } from '../referrals/referrals.service';
import { isListingBoosted } from './listing-boost.util';
import { Prisma } from '@prisma/client';
import type {
  Area,
  City,
  Listing,
  ListingPhoto,
  ListingRenewal,
  ListingVideo,
} from '@prisma/client';
import {
  PHOTO_VARIANTS,
  PhotoVariant,
  extFromMimeType,
  originalKey,
  publicVariantUrl,
  variantKey,
  variantUrl,
} from '../uploads/photo-keys';
import { computeDHash } from '../uploads/photo-hash';
import {
  videoPosterKey,
  videoPosterUrl,
  videoTranscodedKey,
  videoUrl,
} from '../uploads/video-keys';
import { R2StorageService } from '../storage/r2-storage.service';
import { CdnPurgeService } from '../storage/cdn-purge.service';
import { ListListingsDto } from './dto/list-listings.dto';
import { AdminUpdateListingDto, UpdateListingDto } from './dto/update-listing.dto';
import {
  AdminListingSort,
  ListAdminListingsDto,
} from '../admin/dto/list-admin-listings.dto';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { LocationsService } from '../locations/locations.service';
import { ListingSlotsService } from '../listing-slots/listing-slots.service';
import {
  GoogleAdsConversionProvider,
  POST_AD_SUCCESS_CONVERSION_ACTION_ID,
} from '../ads/google-ads-conversion.provider';
import { postAdValueRupees } from '../ads/post-ad-value';
import { ContactRevealService, type ContactRevealState } from '../contact-reveal/contact-reveal.service';
import { PlatformFeeSettingsService } from '../plans/platform-fee-settings.service';
import { platformFeeApplies } from '@bhavano/types/platformFeePricing';
import { scrubPhonesInText } from './scrub-listing-phones';
import { BULK_IMPORT_OWNER_PHONE, isBulkImportOwner } from './bulk-import-owner';
import { assistedClaimCutoff, assistedClaimUrl, maskClaimPhone } from './assisted-listing';

/** `create`'s admin-assisted mode — see ListingsService.createAssisted. */
export interface AssistedCreateOptions {
  claimPhoneE164: string;
  claimName: string;
  claimSellerType: SellerType;
  adminId: string;
}

/** Fixed for now — a future paid-plan tier would compute a different duration here
 * instead of this flat constant, without needing any schema change. */
const DEFAULT_LISTING_DURATION_DAYS = 30;
// BULK_IMPORT_OWNER_PHONE is checked here so create()'s owner-facing side effects (the "your ad
// was posted" WhatsApp/email/SMS, the Google Ads "post ad success" conversion upload) don't fire
// for a phone number nobody's actually monitoring, or attribute a fake acquisition event to a
// system account. savedSearchesService.notifyMatchingBuyers below is NOT skipped — real buyers
// with a matching saved search should hear about a real new listing regardless of which account
// technically posted it.

/** Property types nested under each of the Buy / Rent & Lease browsing tabs — nobody
 * buys/sells Storage or Coworking, so those only appear under Rent & Lease. */
const PROPERTY_TYPES_BY_TAB: Record<'buy' | 'rentLease', PropertyTypeFilter[]> =
  {
    buy: ['house', 'apartment', 'villa', 'plot', 'commercial'],
    rentLease: [
      'house',
      'apartment',
      'villa',
      'storage',
      'coworking',
      'commercial',
    ],
  };

function buildHomeCategoryWhere(
  tab: HomeCategoryFilter | undefined,
  propertyType?: PropertyTypeFilter,
): Prisma.ListingWhereInput {
  // No tab and no raw category/transactionType bypass (checked by the caller before reaching
  // here) means a genuinely unfiltered request — the SEO city-root page, which has no
  // narrower grouping to fall back to.
  if (!tab) return {};
  if (tab === 'pg') return { category: 'pg' };
  if (tab === 'coworking') return { category: 'coworking' };
  if (tab === 'furniture') return { category: 'furniture' };
  if (tab === 'interiors') return { category: 'interiors' };

  const transactionTypes: TransactionType[] =
    tab === 'buy' ? ['buy', 'sell'] : ['rent', 'lease'];
  const allowedCategories = PROPERTY_TYPES_BY_TAB[tab];
  const categories =
    propertyType && allowedCategories.includes(propertyType)
      ? [propertyType]
      : allowedCategories;

  return {
    transactionType: { in: transactionTypes },
    category: { in: categories },
  };
}

/** Every browse page's "Sort By" control — same 4 options for every category, all plain
 * top-level columns. `id: 'asc'` is a tie-breaker in every entry (not just the default), for the
 * same reason it's needed on the default: without it, offset-window pagination can silently shift
 * between requests when rows share an identical sort-key value. */
const ORDER_BY: Record<
  NonNullable<ListListingsDto['sort']>,
  Prisma.ListingOrderByWithRelationInput[]
> = {
  auto: [{ createdAt: 'desc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { id: 'asc' }],
  popular: [{ viewCount: 'desc' }, { id: 'asc' }],
};

/** `sort` values that turn the recent-listings mix (fetchOffsetPage) off — a visitor who
 * explicitly picked "Newest first", "Price: Low to High", "Price: High to Low", or "Most viewed"
 * gets exactly that ordering, boosted listings still first (unchanged, uncapped, same as before
 * Part 2) but no round-robin/cap merging on top of it. 'auto' (the default) is the only case that
 * gets the mix. */
function wantsExplicitSort(sort: ListListingsDto['sort']): boolean {
  return sort === 'newest' || sort === 'price_asc' || sort === 'price_desc' || sort === 'popular';
}

/** Same tie-breaker convention as ORDER_BY above, for the admin listings screen's own
 * (smaller) set of sort options. */
/** `id asc` last in every entry keeps the order total, which the offset pagination relies on —
 * without it a column of repeated values (status, category, a price every listing shares) can
 * shuffle rows between pages. Nulls last in both directions for the nullable ones: an empty cell
 * is never the row worth leading with. */
function adminOrderBy(
  field: Prisma.ListingOrderByWithRelationInput,
): Prisma.ListingOrderByWithRelationInput[] {
  return [field, { id: 'asc' }];
}

const nullsLast = (direction: 'asc' | 'desc') => ({ sort: direction, nulls: 'last' }) as const;

const ADMIN_ORDER_BY: Record<
  AdminListingSort,
  Prisma.ListingOrderByWithRelationInput[]
> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
  updatedAt_desc: [{ updatedAt: 'desc' }, { id: 'asc' }],
  updatedAt_asc: [{ updatedAt: 'asc' }, { id: 'asc' }],
  status_asc: [{ status: 'asc' }, { id: 'asc' }],
  status_desc: [{ status: 'desc' }, { id: 'asc' }],
  title_asc: adminOrderBy({ title: 'asc' }),
  title_desc: adminOrderBy({ title: 'desc' }),
  category_asc: adminOrderBy({ category: 'asc' }),
  category_desc: adminOrderBy({ category: 'desc' }),
  transactionType_asc: adminOrderBy({ transactionType: 'asc' }),
  transactionType_desc: adminOrderBy({ transactionType: 'desc' }),
  moderationState_asc: adminOrderBy({ moderationState: 'asc' }),
  moderationState_desc: adminOrderBy({ moderationState: 'desc' }),
  source_asc: adminOrderBy({ source: 'asc' }),
  source_desc: adminOrderBy({ source: 'desc' }),
  claimSource_asc: adminOrderBy({ claimSource: nullsLast('asc') }),
  claimSource_desc: adminOrderBy({ claimSource: nullsLast('desc') }),
  price_asc: adminOrderBy({ price: 'asc' }),
  price_desc: adminOrderBy({ price: 'desc' }),
  viewCount_asc: adminOrderBy({ viewCount: 'asc' }),
  viewCount_desc: adminOrderBy({ viewCount: 'desc' }),
  likeCount_asc: adminOrderBy({ likeCount: 'asc' }),
  likeCount_desc: adminOrderBy({ likeCount: 'desc' }),
  // A relation count, not a column — the same number the DTO's messageCount reports.
  messageCount_asc: adminOrderBy({ conversations: { _count: 'asc' } }),
  messageCount_desc: adminOrderBy({ conversations: { _count: 'desc' } }),
  expiresAt_asc: adminOrderBy({ expiresAt: 'asc' }),
  expiresAt_desc: adminOrderBy({ expiresAt: 'desc' }),
  organicViewCount_asc: adminOrderBy({ uniqueViewerCount: 'asc' }),
  organicViewCount_desc: adminOrderBy({ uniqueViewerCount: 'desc' }),
  owner_asc: adminOrderBy({ owner: { name: nullsLast('asc') } }),
  owner_desc: adminOrderBy({ owner: { name: nullsLast('desc') } }),
  boosted_asc: adminOrderBy({ boostedUntil: nullsLast('asc') }),
  boosted_desc: adminOrderBy({ boostedUntil: nullsLast('desc') }),
};

const priceFormatter = new Intl.NumberFormat('en-IN');

// `owner` (just agentProUntil) is included here too, alongside every photo/video, since it's
// needed to resolve the poster's video entitlement on every read that also needs videos — folding
// it into this one shared constant (spread at every call site already) avoids special-casing the
// handful of owner/admin-only call sites that actually need it.
const LISTING_MEDIA_INCLUDE = {
  // displayOrder first (gallery position, freely reassignable via "set as cover"), photoNo as
  // the tie-breaker — see ListingPhoto.displayOrder's own doc comment.
  listingPhotos: { orderBy: [{ displayOrder: 'asc' as const }, { photoNo: 'asc' as const }] },
  listingVideos: { orderBy: { videoNo: 'asc' as const } },
  // phone/email are never sent to the client directly from toDetailDto — only echoed back into
  // ownerPhone/ownerEmail once ContactRevealService confirms this viewer has actually unlocked
  // them (see toDetailDto's revealState param).
  owner: {
    select: { agentProUntil: true, phone: true, email: true, sellerType: true, agencyName: true, reraVerifiedAt: true },
  },
  listingRenewals: { orderBy: { renewedAt: 'desc' as const } },
  // The scraped business's own phone/email, for findOne's getRevealState call — an
  // ownerUnverified listing's real owner is the Bulk Import account (nobody), but the business
  // itself (if its OutreachContact row has a phone/email) can still be reached directly.
  claimContact: { select: { phone: true, email: true } },
};


/** The two or three chips a card shows under the title.
 *
 * Derived from the attributes the seller already filled in rather than from a second free-text
 * box — which is how production ended up with "3bhk", "3 BHK" and "3 Beds" as three spellings of
 * one bedroom count, and a bare "1500" that did not say what it measured.
 *
 * Falls back to the stored `specs` column, which is what listings posted before this still carry.
 * An empty derived array is a real answer ("nothing to show") but indistinguishable here from
 * "this predates the field", so the fallback wins whenever there is nothing to derive.
 */
function cardSpecs(listing: { category: ListingCategory; attributes: unknown; specs: string[] }): string[] {
  const derived = deriveCardSpecs(
    listing.category,
    listing.attributes as Record<string, unknown>,
  );
  return derived.length > 0 ? derived.slice(0, 3) : listing.specs;
}

/** A listing's own "Posted by Broker / Agent" (`fromBroker`) answer as a SellerType — null when
 * it was left blank or the category has no such field. */
function fromBrokerAnswer(attributes: unknown): SellerType | null {
  const value = (attributes as Record<string, unknown> | null)?.fromBroker;
  return value === 'yes' ? 'agent' : value === 'no' ? 'owner' : null;
}

/** Reconciles the two ways a poster says who they are: the per-listing `fromBroker` field (optional,
 * and mostly left blank) and the account's `User.sellerType` (asked once). A blank `fromBroker` is
 * filled from the account's answer so the label and the brokerage fields agree. Only `postedAs`
 * (sent by the wizard while the account has no answer) saves to the account: a bare `fromBroker`
 * never does, because older mobile builds preset every Yes/No field to "No", so a listing's "no"
 * isn't proof its poster is an owner. See docs/plans/broker-paid-bundles.md, Phase 0. */
export function resolveDeclaredSellerType(
  category: ListingCategory,
  attributes: Record<string, unknown>,
  postedAs: SellerType | undefined,
  profileSellerType: SellerType | null,
): { attributes: Record<string, unknown>; saveToProfile: SellerType | null } {
  const listingAnswer = fromBrokerAnswer(attributes);
  const hasField = CATEGORY_FIELD_CONFIG[category].some((f) => f.key === 'fromBroker');
  const effective = postedAs ?? listingAnswer ?? profileSellerType;
  const filled =
    hasField && !listingAnswer && effective
      ? { ...attributes, fromBroker: effective === 'agent' ? 'yes' : 'no' }
      : attributes;
  return {
    attributes: filled,
    saveToProfile: postedAs && postedAs !== profileSellerType ? postedAs : null,
  };
}

/** update()'s own before/after diff for ListingEditLog — only the keys actually present in
 * `updates` (an UpdateListingDto field left undefined means "not touched", not "set to
 * undefined") and only where the value genuinely changed. JSON.stringify comparison rather than
 * `!==` because `attributes` is an object — reference inequality would flag it as "changed" on
 * every edit even when its content is identical. */
function diffFields(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const [key, after] of Object.entries(updates)) {
    if (after === undefined) continue;
    const before = existing[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes[key] = { before, after };
    }
  }
  return changes;
}

/** Only the first 2 pages of the public browse/homepage feed get the recent-listings mix below —
 * see docs/plans/homepage-category-mix-and-boost-page-cap.md. Page 3+ stays plain `createdAt
 * desc`, unchanged: recomputing the mix on every request would be wasted work nobody paging that
 * deep benefits from — that's browsing with intent, not skimming what's new. */
const RECENT_MIX_PAGES = 2;
/** How far back "recent" reaches for the mix — long enough that a bulk-import run (which inserts
 * dozens of same-category/same-city rows within seconds of each other) doesn't get to dominate
 * the "newest" slice of a flat createdAt-desc sort for days on end. */
const RECENT_MIX_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
/** Safety cap on how many recent rows get pulled into memory to interleave — the recent window is
 * normally a few hundred rows at most even on an active day; this just guards against a
 * pathological bulk-import size turning this into an unbounded fetch. */
const RECENT_MIX_POOL_CAP = 1000;

/** Part 2 of the plan doc: bounds how many boosted listings can occupy the guaranteed-first
 * "featured" slots, so the boost tier stays a real page-1/page-2 differentiator instead of
 * (once boost adoption grows past this) spilling onto page 3+ and pushing organic content out of
 * sight entirely — if everyone's boosted, nobody is.
 *
 * **(2026-10-01) A fraction of the window, not a flat constant.** Was a flat 8 (4/page ×
 * `RECENT_MIX_PAGES`) until boost adoption (20 listings) grew past it on a 2-page/24-slot window —
 * a flat cap that stops scaling with demand just pushes more and more paying listings into "badge
 * only, no guaranteed slot" limbo as adoption grows, which is exactly the "paid but got nothing"
 * complaint that motivated capping it in the first place (it exists to protect organic content
 * from boost, not to arbitrarily shortchange boost buyers once there's real demand for it).
 *
 * **(2026-10-02) Per page, not per window.** The fraction above used to apply to the whole
 * `windowSize = RECENT_MIX_PAGES * limit` and front-load onto page 1 first — exactly the
 * "straightforward to add later if page 1 ends up feeling crowded" caveat this comment used to
 * end with. It did: with the homepage's Featured rail (up to 10 boosted listings,
 * `docs/plans/featured-listings-visibility-improvements.md`) *also* drawing from the same pool,
 * and boost adoption (~12-13) at/over the old whole-window cap (12), page 1's entire grid was
 * boosted — confirmed directly against production (curled the homepage, 0 of 12 grid listings were
 * organic despite 43 pages of real inventory existing). Fixed by applying this fraction to one
 * page (`limit`) at a time instead of the whole window, and by computing the rail and the grid's
 * cap from one shared boosted-listings fetch (`featuredRailSize`, see `fetchOffsetPage`) instead
 * of two independent, uncoordinated ones — see that doc's Part 2 for the full writeup.
 * Organic/recent-mix content is now guaranteed at least 3/4 of every page, not just half of the
 * whole window. Naturally still shrinks below the ceiling when there simply aren't that many
 * boosted listings (`.slice()` below only ever takes as many as exist) — this never *forces* extra
 * listings into the cap.
 *
 * **Which listings fill the cap is round-robin'd by `recentMixGroupKey`** (see fetchOffsetPage),
 * not a flat top-N-by-boostRank slice — checked against prod at the same time as the 2026-10-01
 * change above: a flat slice let whichever category had the most boost buyers take every
 * guaranteed slot, so a seller who boosted the only listing in their category could still be shut
 * out entirely despite paying the same price. Same "one oversized group buries the rest" fix Part 1
 * already applies to the recent pool, applied here too.
 *
 * Listings boosted *beyond* the cap are not hidden or demoted — they compete in the normal
 * recent-mix/older pools on their own merits (see fetchOffsetPage) and still carry the "⭐
 * Featured" badge (ListingCardDto.isBoosted, driven by boostedUntil independent of this cap) —
 * they just don't get the guaranteed top slot. No residual ranking bump past the cap either: the
 * simplest option, and it avoids a slow creep back toward "boost dominates everything" as more
 * listings buy it. */
const BOOST_FEATURED_CAP_PER_PAGE_FRACTION = 0.25;

/** The dimension each home tab mixes recent listings by — property category for the multi-
 * category tabs (All/Buy/Rent & Lease all pass `homeCategory` as undefined/'buy'/'rentLease'),
 * or a category-specific facet for the single-category tabs (PG's sharing type, Furniture's
 * condition, Interiors' service type — the one real ListingCategory in each of those tabs has
 * nothing to mix by, so the facet is what actually varies).
 *
 * City folds into the key too, but only when browsing all cities: once `cityIdFilter` is set,
 * every candidate row already shares that city, so adding it to the key would split rows into
 * groups of one instead of fixing anything. See docs/plans/homepage-category-mix-and-boost-page-
 * cap.md for the full reasoning, including why city (not area — too fine-grained, mostly empty
 * buckets) is the geography dimension. */
export function recentMixGroupKey(
  homeCategory: HomeCategoryFilter | undefined,
  cityIdFilter: string | undefined,
  listing: { category: ListingCategory; attributes: unknown; cityId: string },
): string {
  let dimension: string;
  if (!homeCategory || homeCategory === 'buy' || homeCategory === 'rentLease') {
    dimension = listing.category;
  } else {
    const facetKey = homeCategory === 'pg' ? 'sharingType' : homeCategory === 'furniture' ? 'condition' : 'serviceType';
    const facetValue = (listing.attributes as Record<string, unknown>)[facetKey];
    // Furniture's condition and Interiors' serviceType are still plain `type: "select"` fields
    // (a bare string) — but pg's sharingType is multi-select (a string[]), since a PG can offer
    // more than one. Sort before joining so a listing's group key doesn't depend on the order
    // its sharing types happen to be stored in — "double+single" and "single+double" must be the
    // same group. Missing, or a stray non-string/empty value, groups under one shared
    // "unspecified" bucket rather than being trusted to stringify sensibly.
    const facetLabel = Array.isArray(facetValue)
      ? facetValue.filter((v): v is string => typeof v === 'string' && v.length > 0).sort().join('+')
      : typeof facetValue === 'string' ? facetValue : '';
    dimension = facetLabel || 'unspecified';
  }
  return cityIdFilter ? dimension : `${dimension}::${listing.cityId}`;
}

/** Interleaves `rows` (assumed already sorted newest-first) round-robin across whatever groups
 * `keyFor` sorts them into: the newest row from every group first, then the second-newest from
 * every group, and so on — so one oversized group (a bulk-import batch) supplies one slot per
 * round same as a group of one, instead of burying every other group under it. Group order in
 * each round follows first-appearance order in `rows`, so the group holding the single newest row
 * overall goes first, same intuition as sorting by "newest row in this group" descending. */
export function roundRobinByGroup<T>(rows: T[], keyFor: (row: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  const buckets = [...groups.values()];
  const result: T[] = [];
  for (let index = 0; result.length < rows.length; index++) {
    for (const bucket of buckets) {
      if (index < bucket.length) result.push(bucket[index]);
    }
  }
  return result;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly savedSearchesService: SavedSearchesService,
    private readonly locationsService: LocationsService,
    private readonly storage: R2StorageService,
    private readonly cdnPurge: CdnPurgeService,
    private readonly listingSlotsService: ListingSlotsService,
    private readonly googleAdsConversionProvider: GoogleAdsConversionProvider,
    private readonly contactRevealService: ContactRevealService,
    private readonly platformFeeSettingsService: PlatformFeeSettingsService,
    private readonly pushService: PushService,
    private readonly analyticsService: AnalyticsService,
    private readonly referralsService: ReferralsService,
  ) {}

  async list(
    query: ListListingsDto,
    currentUserId?: string,
  ): Promise<ListingsPage> {
    const {
      homeCategory,
      propertyType,
      category,
      transactionType,
      cityId,
      ownerId,
      areaId,
      areaIds,
      q,
      minPrice,
      maxPrice,
      bedrooms,
      furnished,
      postedBy,
      amenities,
      sharingType,
      condition,
      serviceType,
      cursor,
      offset,
      limit,
      sort,
    } = query;

    // Raw category/transactionType (used only by the SEO browse-landing pages) bypasses
    // the homeCategory/propertyType tab-grouping entirely — the interactive homepage
    // never sends these, so its behavior is unchanged.
    const categoryWhere: Prisma.ListingWhereInput =
      category || transactionType
        ? {
            ...(category ? { category } : {}),
            ...(transactionType ? { transactionType } : {}),
          }
        : buildHomeCategoryWhere(homeCategory, propertyType);

    // Bedrooms/furnished live in the `attributes` JSONB column, so each needs its own
    // top-level AND entry — merging them into one `attributes` key would let the second
    // silently overwrite the first.
    const attributeFilters: Prisma.ListingWhereInput[] = [];
    // Multi-select BHK — an OR of per-bucket clauses (exact match for 1-4, "N or more" for the
    // 5+ bucket), not a single `gte` — picking 1 and 3 should match exactly-1-bedroom listings
    // too, which a single `gte: 1` would already do but a single `gte: 3` would wrongly exclude.
    if (bedrooms && bedrooms.length > 0) {
      attributeFilters.push({
        OR: bedrooms.map((n) =>
          n >= MAX_BEDROOMS
            ? { attributes: { path: ['bedrooms'], gte: n } }
            : { attributes: { path: ['bedrooms'], equals: n } },
        ),
      });
    }
    if (furnished)
      attributeFilters.push({
        attributes: { path: ['furnished'], equals: furnished },
      });
    // Mirrors postedBy(): the listing's own fromBroker answer wins, else the account's. A blank
    // fromBroker is matched explicitly (missing key or ""), because NOT on a JSON path drops rows
    // where the key is absent — which is most listings.
    if (postedBy === 'owner')
      attributeFilters.push({
        OR: [
          { attributes: { path: ['fromBroker'], equals: 'no' } },
          {
            owner: { sellerType: 'owner' },
            OR: [
              { attributes: { path: ['fromBroker'], equals: Prisma.AnyNull } },
              { attributes: { path: ['fromBroker'], equals: '' } },
            ],
          },
        ],
      });
    // One clause per amenity, ANDed — two ticked boxes mean a place with both. Each is its own
    // top-level entry for the same reason the comment above gives: merging them under one
    // `attributes` key would let the last one silently win.
    if (amenities && amenities.length > 0) {
      for (const key of amenities) {
        attributeFilters.push({ attributes: { path: [key], equals: 'yes' } });
      }
    }
    // sharingType is multi-select (a PG can offer more than one) — array_contains, not equals,
    // since the stored attribute is now a string[] rather than a scalar.
    if (sharingType)
      attributeFilters.push({
        attributes: { path: ['sharingType'], array_contains: sharingType },
      });
    if (condition)
      attributeFilters.push({
        attributes: { path: ['condition'], equals: condition },
      });
    if (serviceType)
      attributeFilters.push({
        attributes: { path: ['serviceType'], equals: serviceType },
      });

    // Word match, not phrase match, and typo-tolerant: each word in `q` must appear *somewhere*
    // in the title, in any order — "wooden wardrobe" matches "Wooden Wardrobe for sale" as well
    // as "Wardrobe, wooden, excellent condition" — matched either as a literal substring or, via
    // pg_trgm's word_similarity(), a close-enough spelling variant (so searching "Koramangala"
    // still finds a title spelled "Kormangala"). ILIKE stays in the OR because trigram similarity
    // is unreliable for very short words ("PG", "3BHK"), which a plain substring check still
    // handles correctly. A single-word query is a superset of the old whole-string `contains`
    // (every title the old check found still has similarity 1.0 against itself), not a change to
    // its prior behavior.
    let titleMatchedIds: string[] | undefined;
    if (q) {
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const wordConditions = words.map(
          (word) =>
            Prisma.sql`(title ILIKE ${'%' + word + '%'} OR word_similarity(lower(${word}), lower(title)) > 0.3)`,
        );
        const rows = await this.prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM "Listing" WHERE ${Prisma.join(wordConditions, ' AND ')}`,
        );
        titleMatchedIds = rows.map((r) => r.id);
      }
    }

    const andFilters = [
      ...attributeFilters,
      ...(titleMatchedIds ? [{ id: { in: titleMatchedIds } }] : []),
    ];

    const where: Prisma.ListingWhereInput = {
      ...categoryWhere,
      status: 'active',
      publishState: 'live',
      moderationState: 'approved',
      // No expiresAt gate — see docs/plans/explicit-close-not-auto-expire.md. A listing only
      // leaves the grid when its own status changes (owner/admin closes it), never just from
      // age; `status: 'active'` above is the only visibility gate now.
      ...(cityId ? { cityId } : {}),
      ...(ownerId ? { ownerId } : {}),
      // `areaIds` (the multi-select browse filter) wins over the single `areaId` (the SEO
      // locality path) when both are somehow present — they're never sent together in practice.
      ...(areaIds && areaIds.length > 0
        ? { areaId: { in: areaIds } }
        : areaId
          ? { areaId }
          : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    // Boosted listings (non-null boostRank) always sort ahead of unboosted ones, regardless of
    // the chosen sort — but *among* boosted listings, order is whatever BoostRotationService's
    // periodic reshuffle last set, not purchase recency/duration, so nobody permanently squats
    // the top slot (see docs/plans/monetization-boosted-listings-premium-tiers.md).
    const orderBy: Prisma.ListingOrderByWithRelationInput[] = [
      { boostRank: { sort: 'desc', nulls: 'last' } },
      ...ORDER_BY[sort ?? 'auto'],
    ];

    // Offset mode (numbered `?page=N` pagination — see ListListingsDto.offset) fetches the exact
    // window directly, since the caller already knows the total and doesn't need a `hasMore`
    // look-ahead row the way cursor-based append does. Two explicit branches (rather than
    // spreading a ternary into one `findMany` call) because Prisma's generated overloads can't
    // resolve a call built from a union of arg shapes.
    //
    // Cursor mode (mobile infinite scroll) is deliberately left out of the recent-listings mix
    // below — round-robin reordering the first pages doesn't map cleanly onto an append-only
    // cursor the way it does onto numbered offset pages, and every offset-mode consumer (the
    // homepage, BrowseListingsView) already gets the fix. Worth revisiting for mobile separately.
    const [{ items: rows, featuredRail }, total] = await Promise.all([
      offset !== undefined
        ? this.fetchOffsetPage(where, orderBy, offset, limit, homeCategory, cityId, wantsExplicitSort(sort), query.featuredRailSize)
        : this.prisma.listing
            .findMany({
              where,
              include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
              orderBy,
              take: limit + 1,
              ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            })
            .then((items) => ({ items, featuredRail: [] as typeof items })),
      this.prisma.listing.count({ where }),
    ]);

    if (offset !== undefined) {
      // One combined lookup for both arrays — the homepage's Featured rail and the main grid are
      // now a single request (see ListListingsDto.featuredRailSize), so there's no reason to ask
      // twice for the same visitor's favourite/contact-reveal state.
      const allRows = [...rows, ...featuredRail];
      const favouritedIds = await this.getFavouritedIds(
        currentUserId,
        allRows.map((r) => r.id),
      );
      const revealStates = await this.contactRevealService.getRevealStatesForListings(
        currentUserId,
        allRows.map((r) => ({ id: r.id, ownerPhone: r.owner.phone, ownerEmail: r.owner.email })),
      );
      return {
        items: rows.map((row) => this.toCardDto(row, favouritedIds, currentUserId, revealStates)),
        // undefined ("no rail requested") is distinct from `[]` ("requested, nothing boosted") —
        // see ListingsPage.featuredRail's own doc comment.
        featuredRail:
          query.featuredRailSize !== undefined
            ? featuredRail.map((row) => this.toCardDto(row, favouritedIds, currentUserId, revealStates))
            : undefined,
        nextCursor: null,
        total,
      };
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const favouritedIds = await this.getFavouritedIds(
      currentUserId,
      page.map((r) => r.id),
    );
    const revealStates = await this.contactRevealService.getRevealStatesForListings(
      currentUserId,
      page.map((r) => ({ id: r.id, ownerPhone: r.owner.phone, ownerEmail: r.owner.email })),
    );

    return {
      items: page.map((row) => this.toCardDto(row, favouritedIds, currentUserId, revealStates)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /** `list()`'s offset-mode row fetch — plain for page 3+, mixed for the first
   * `RECENT_MIX_PAGES` pages (see docs/plans/homepage-category-mix-and-boost-page-cap.md). Also
   * computes the homepage's own Featured rail in the same pass when `featuredRailSize` is given —
   * see `featuredRail` below — instead of the website issuing a second, separate request for it
   * (the 2026-10-02 single-query merge: the rail and the grid were two independently-uncoordinated
   * queries before this, which is how they ended up guaranteeing the same boosted listings a slot
   * twice while leaving the grid otherwise 100% boosted).
   *
   * The mixed path fetches three disjoint slices, then assembles each of the first
   * `RECENT_MIX_PAGES` pages as its own chunk (see the per-page loop below) — deterministic given
   * unchanged underlying data, so two requests for page 1 and page 2 of the same query produce
   * consecutive, non-repeating results, same stability guarantee a plain `skip`/`take` already has
   * (and the same caveat: a listing created between the two requests can still shift what "page 2"
   * contains, exactly as it could before this existed):
   *
   * 1. Every boosted (`boostRank` not null) match, round-robin'd by `recentMixGroupKey`. The first
   *    `featuredRailSize` of those become `featuredRail`; the main grid's own cap is capped at
   *    `perPageCap` *per page* (`BOOST_FEATURED_CAP_PER_PAGE_FRACTION` of `limit`) from whatever's
   *    left after that — a guaranteed slot per group before any group gets a second one, so a
   *    boost buyer in a thin category isn't shut out by one with more boosted listings (see Part 2
   *    of the plan doc). The overflow past both reservations still competes below, unordered by
   *    boostRank at that point — it's just another row in whichever pool it lands in.
   * 2. The "recent" pool (created within `RECENT_MIX_WINDOW_MS`, not boosted), round-robin'd by
   *    `recentMixGroupKey` so no single group can bury the rest.
   * 3. If 1+2 don't fill the window, the next-oldest non-boosted rows, plainly sorted — same
   *    order page 3+ already uses, just topping up the tail of page 2 when the recent pool runs
   *    dry (a slow week, or a very narrow filter).
   */
  private async fetchOffsetPage(
    where: Prisma.ListingWhereInput,
    orderBy: Prisma.ListingOrderByWithRelationInput[],
    offset: number,
    limit: number,
    homeCategory: HomeCategoryFilter | undefined,
    cityId: string | undefined,
    /** true for an explicitly-chosen sort (Newest/Price/Most viewed) — see wantsExplicitSort.
     * Falls straight through to the plain query for every page, not just page 3+: a visitor who
     * asked for "Newest first" or "Price: Low to High" wants exactly that, not a round-robin'd/
     * boost-capped reshuffle of it. Boosted listings still sort first regardless (unchanged,
     * uncapped — same as before Part 2 existed), since that part of the ordering isn't what
     * "sort by" is about. */
    explicitSort: boolean,
    /** `ListListingsDto.featuredRailSize` — how many of the round-robin'd boosted matches to carve
     * off as the homepage's own Featured rail (`featuredRail` below) and reserve past when
     * computing the grid's own smaller per-page cap. `undefined` for every caller without a rail
     * (BrowseListingsView), which behaves exactly as if this parameter didn't exist. */
    featuredRailSize: number | undefined,
  ) {
    const include = { city: true, area: true, ...LISTING_MEDIA_INCLUDE };

    if (explicitSort || offset >= RECENT_MIX_PAGES * limit) {
      const items = await this.prisma.listing.findMany({ where, include, orderBy, skip: offset, take: limit });
      return { items, featuredRail: [] };
    }

    const windowSize = RECENT_MIX_PAGES * limit;
    const recentSince = new Date(Date.now() - RECENT_MIX_WINDOW_MS);
    const plainRecentSort: Prisma.ListingOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'asc' }];

    // All matches, boosted or not, still get pulled into the recent/older pools below — capping
    // `featuredRows` to `perPageCap` doesn't exclude the overflow from the feed, it just
    // stops guaranteeing them the top slot. `featuredIds` is how the two later queries avoid
    // showing an already-featured row a second time in its own natural position.
    const [allBoosted, recentPool] = await Promise.all([
      this.prisma.listing.findMany({ where: { ...where, boostRank: { not: null } }, include, orderBy }),
      this.prisma.listing.findMany({
        where: { ...where, createdAt: { gte: recentSince } },
        include,
        orderBy: plainRecentSort,
        take: RECENT_MIX_POOL_CAP,
      }),
    ]);
    // Round-robin'd by the same group key as the recent pool below — otherwise whichever category
    // happens to have the most boost buyers wins every guaranteed slot, same "one oversized group
    // buries the rest" problem Part 1 already solved for recent listings. A boostRank-sorted slice
    // still happens *within* each group, so the rotation fairness BoostRotationService provides is
    // unchanged — this only changes which *groups* get represented in the cap, not the order
    // within a group.
    const priorityBoosted = roundRobinByGroup(allBoosted, (row) => recentMixGroupKey(homeCategory, cityId, row));
    // The homepage's own Featured rail — see featuredRailSize's own doc comment above. Computed
    // from the exact same `priorityBoosted` list the grid's cap reserves past, so the two are
    // disjoint by construction, not by a second query's filters happening to line up.
    const featuredRail = priorityBoosted.slice(0, featuredRailSize ?? 0);
    const afterRailReserve = priorityBoosted.slice(featuredRailSize ?? 0);
    // Grows with real demand instead of staying fixed — see
    // BOOST_FEATURED_CAP_PER_PAGE_FRACTION's own comment — but never past a quarter of *each*
    // page, so organic content always keeps the rest of every page, not just the window overall.
    const perPageCap = Math.floor(limit * BOOST_FEATURED_CAP_PER_PAGE_FRACTION);
    const featuredRows = afterRailReserve.slice(0, perPageCap * RECENT_MIX_PAGES);
    const featuredIds = new Set([...featuredRows, ...featuredRail].map((row) => row.id));

    const mixedRecent = roundRobinByGroup(
      recentPool.filter((row) => !featuredIds.has(row.id)),
      (row) => recentMixGroupKey(homeCategory, cityId, row),
    );

    const stillNeeded = windowSize - featuredRows.length - mixedRecent.length;
    const olderRows =
      stillNeeded > 0
        ? (
            await this.prisma.listing.findMany({
              where: { ...where, createdAt: { lt: recentSince } },
              include,
              orderBy: plainRecentSort,
              take: stillNeeded + featuredIds.size,
            })
          ).filter((row) => !featuredIds.has(row.id))
        : [];

    // Assembled page by page — page 1 gets featuredRows' own first `perPageCap` rows, page 2 gets
    // the *next* `perPageCap`, and so on — instead of one flat `[...featuredRows, ...]` block up
    // front, which let whichever page was requested first claim the entire window's cap (see
    // BOOST_FEATURED_CAP_PER_PAGE_FRACTION's 2026-10-02 update for why that was the actual "only
    // featured ads, normal ads start on page 2" complaint). `nonFeatured` fills whatever each
    // page's `pageFeatured` chunk leaves open, drawing down the same shared queue across pages so
    // nothing is skipped or repeated between them.
    const nonFeatured = [...mixedRecent, ...olderRows];
    const pages: typeof allBoosted = [];
    let cursor = 0;
    for (let p = 0; p < RECENT_MIX_PAGES; p++) {
      const pageFeatured = featuredRows.slice(p * perPageCap, (p + 1) * perPageCap);
      const fill = nonFeatured.slice(cursor, cursor + (limit - pageFeatured.length));
      cursor += fill.length;
      pages.push(...pageFeatured, ...fill);
    }

    return { items: pages.slice(offset, offset + limit), featuredRail };
  }

  /** Admin moderation queue — every listing regardless of status/moderationState/expiry
   * (unlike the public `list()`, which only ever shows approved, active, unexpired ones). */
  async listForAdmin(query: ListAdminListingsDto): Promise<AdminListingsPage> {
    const {
      search,
      moderationState,
      adminReviewed,
      category,
      transactionType,
      status,
      publishState,
      cityId,
      areaId,
      userId,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      sort,
      offset,
      limit,
    } = query;
    const where: Prisma.ListingWhereInput = {
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      ...(moderationState ? { moderationState } : {}),
      ...(publishState ? { publishState } : {}),
      ...(adminReviewed !== undefined ? { adminReviewed } : {}),
      ...(category ? { category } : {}),
      ...(transactionType ? { transactionType } : {}),
      ...(status ? { status } : {}),
      ...(cityId ? { cityId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(userId ? { ownerId: userId } : {}),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
              ...(createdTo ? { lte: new Date(createdTo) } : {}),
            },
          }
        : {}),
      ...(updatedFrom || updatedTo
        ? {
            updatedAt: {
              ...(updatedFrom ? { gte: new Date(updatedFrom) } : {}),
              ...(updatedTo ? { lte: new Date(updatedTo) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        // No ...LISTING_MEDIA_INCLUDE here (photos/videos/owner/renewals) — AdminListingsTable
        // never reads any of it; see AdminListingRowDto's own doc comment. Expanding a row fetches
        // the full ListingDetailDto on demand instead of every row paying for it on every load.
        include: {
          city: true,
          area: true,
          owner: { select: { id: true, name: true, phone: true } },
          // Newest "posted" row only — mirrors AdminService.listUsers' notificationLogs include
          // for the "welcomed" column. Admin-only: no other listForAdmin caller pays for this.
          notificationLogs: {
            // Both kinds in one relation load rather than two includes (Prisma allows only one
            // per relation): 'posted' is a one-shot the columns below read as newest-only, and
            // every 'boost_promo' row is needed since the point is how many went out. `take` is
            // generous rather than absent — a listing promoted every cooldown for a year is 26
            // rows, and nothing here wants an unbounded relation load.
            where: { kind: { in: ['posted', 'boost_promo'] } },
            orderBy: { sentAt: 'desc' },
            take: 60,
          },
          // Buyer-inquiry count for the admin dashboard's Messages column — a filtered relation
          // count, not a second query, and never includes the admin↔owner moderation thread
          // (same listingId, different `type`).
          _count: { select: { conversations: { where: { type: 'inquiry' } } } },
        },
        orderBy: ADMIN_ORDER_BY[sort ?? 'createdAt_desc'],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: rows.map((row) => {
        // Split here rather than in two queries — see the include's own comment.
        const posted = row.notificationLogs.filter((log) => log.kind === 'posted');
        const promos = row.notificationLogs.filter((log) => log.kind === 'boost_promo');
        return {
        ...this.toAdminQueueRowDto(row),
        postedNotificationSent: posted.length > 0,
        postedNotificationChannel: posted[0]?.channel ?? null,
        postedNotificationSentAt: posted[0]?.sentAt.toISOString() ?? null,
        postedNotificationDeliveryStatus: posted[0]?.deliveryStatus ?? null,
        boostPromo: {
          emailCount: promos.filter((log) => log.channel === 'email').length,
          whatsappCount: promos.filter((log) => log.channel === 'whatsapp').length,
          inAppCount: promos.filter((log) => log.channel === 'in_app').length,
          // Ordered newest-first by the include, so the first row is the latest send on any
          // channel — an owner with both gets two rows a second apart, and either answers "when".
          lastSentAt: promos[0]?.sentAt.toISOString() ?? null,
        },
        messageCount: row._count.conversations,
        source: row.source,
        claimSource: row.claimSource,
        };
      }),
      total,
    };
  }

  /** Thin row mapper for the admin moderation queue only — see AdminListingRowDto's own doc
   * comment for why this exists separately from toCardDto/toDetailDto: neither of those can be
   * reused here without also pulling in listingPhotos/listingVideos (toCardDto's own required
   * fields), which AdminListingsTable never renders. The two-line price-formatting rule below
   * duplicates toCardDto's rather than sharing it, since sharing would mean widening this query's
   * `include` right back out to match toCardDto's signature. */
  private toAdminQueueRowDto(
    listing: Listing & { city: City; area: Area; owner: { id: string; name: string | null; phone: string | null } },
  ): AdminListingRowDto {
    return {
      id: listing.id,
      title: listing.title,
      status: listing.status,
      publishState: listing.publishState,
      moderationState: listing.moderationState,
      adminReviewed: listing.adminReviewed,
      category: listing.category,
      transactionType: listing.transactionType,
      cityName: listing.city.name,
      area: listing.area.name,
      owner: listing.owner,
      isBoosted: isListingBoosted(listing),
      boostedUntil: listing.boostedUntil?.toISOString() ?? null,
      price: this.formatListingPrice(listing),
      priceInWords: this.formatListingPriceInWords(listing),
      totalPrice: this.listingTotalPrice(listing),
      priceQualifier: listing.price === 0 ? '' : listing.priceQualifier,
      viewCount: listing.viewCount,
      organicViewCount: listing.uniqueViewerCount,
      likeCount: listing.likeCount,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
    };
  }

  /** A listing's "History" tab — every ListingEditLog row, newest first. `actorName` is resolved
   * here (not stored denormalized on the log row) so a later name change is reflected
   * retroactively rather than freezing whatever the actor was called at the time — same tradeoff
   * AdminPaymentDto.userName already makes. Null for 'system' rows (no actorId at all). */
  async listEditHistory(listingId: string, offset: number, limit: number): Promise<ListingEditLogPage> {
    const [rows, total] = await Promise.all([
      this.prisma.listingEditLog.findMany({
        where: { listingId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.listingEditLog.count({ where: { listingId } }),
    ]);

    const items: ListingEditLogEntryDto[] = rows.map((row) => ({
      id: row.id,
      actorType: row.actorType as ListingEditLogEntryDto['actorType'],
      actorId: row.actorId,
      actorName: row.actor?.name ?? null,
      action: row.action,
      changes: row.changes as ListingEditLogEntryDto['changes'],
      createdAt: row.createdAt.toISOString(),
    }));

    return { items, total };
  }

  /** One listing's "Liked & Viewed" admin table — merges `Favourite` rows (a real `User` FK
   * already) with logged-in-viewer `ListingView` rows (`viewerKey` prefixed `user:`, resolved to
   * a real user by stripping the prefix and batch-fetching). Anonymous views (`viewerKey`
   * prefixed `anon:`) have no resolvable user and are never included — the listing's own
   * `viewCount` (which does count them) is the only place that total is visible. Merged and
   * paginated in memory rather than with raw SQL — the first `$queryRaw` in this codebase would
   * be a bigger departure than justified for a single listing's rows, and `take: offset + limit`
   * on each source keeps this bounded (never a global scan) even at the page-size cap. The same
   * user can appear twice — liked and viewed are two different rows/actions, not deduplicated. */
  async listEngagement(
    listingId: string,
    offset: number,
    limit: number,
  ): Promise<ListingEngagementPage> {
    const take = offset + limit;
    const [favourites, views, favouriteCount, viewCount] = await Promise.all([
      this.prisma.favourite.findMany({
        where: { listingId },
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.listingView.findMany({
        where: { listingId, viewerKey: { startsWith: 'user:' } },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.favourite.count({ where: { listingId } }),
      this.prisma.listingView.count({
        where: { listingId, viewerKey: { startsWith: 'user:' } },
      }),
    ]);

    const viewerUserIds = views.map((v) => v.viewerKey.slice('user:'.length));
    const users = await this.prisma.user.findMany({
      where: { id: { in: viewerUserIds } },
      select: { id: true, name: true, phone: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const merged: ListingEngagementRowDto[] = [
      ...favourites.map((f): ListingEngagementRowDto => ({
        userId: f.user.id,
        userName: f.user.name,
        userPhone: f.user.phone,
        userEmail: f.user.email,
        action: 'liked',
        at: f.createdAt.toISOString(),
      })),
      ...views.flatMap((v): ListingEngagementRowDto[] => {
        // Dropped, not shown as a broken row — the user behind this view was deleted since.
        const user = userById.get(v.viewerKey.slice('user:'.length));
        if (!user) return [];
        return [
          {
            userId: user.id,
            userName: user.name,
            userPhone: user.phone,
            userEmail: user.email,
            action: 'viewed',
            at: v.createdAt.toISOString(),
          },
        ];
      }),
    ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    return {
      items: merged.slice(offset, offset + limit),
      total: favouriteCount + viewCount,
    };
  }

  async setAdminReviewed(
    id: string,
    adminReviewed: boolean,
  ): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { adminReviewed },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    return this.toDetailDto(listing, undefined, true);
  }

  /** Takes a listing offline (this IS the soft-delete — see ModerationState) and marks it
   * reviewed. Posting the discrepancy message to the owner is the caller's (AdminService's)
   * job, via MessagingService, so this stays a plain listing-state mutation. */
  async flag(id: string, adminId: string): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({
      where: { id },
      select: { moderationState: true },
    });
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        moderationState: 'flagged',
        adminReviewed: true,
        moderatedAt: new Date(),
      },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    await this.logEdit(id, 'admin', adminId, 'flagged', {
      moderationState: { before: existing?.moderationState ?? null, after: 'flagged' },
    });
    // Referral program BR-5 — a flag is the de-facto takedown (flagged listings fail every public
    // visibility query), so this is one of the two revocation triggers alongside deleteCompletely.
    // See revokeIfTakenDown's own doc comment for why setStatusAsAdmin's `deactivated` is not a
    // third trigger.
    this.referralsService.revokeIfTakenDown(listing.ownerId, 'Listing flagged').catch(() => undefined);
    return this.toDetailDto(listing, undefined, true);
  }

  /** Puts a previously-flagged listing back in front of buyers. */
  async approve(id: string, adminId: string): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({
      where: { id },
      select: { moderationState: true },
    });
    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        moderationState: 'approved',
        adminReviewed: true,
        moderatedAt: new Date(),
      },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    await this.logEdit(id, 'admin', adminId, 'approved', {
      moderationState: { before: existing?.moderationState ?? null, after: 'approved' },
    });
    // Referral program, Phase 3 — the other path (besides runPostLiveSideEffects) a listing can
    // reach "live and approved" through: an admin un-flagging one that was moderated before its
    // own first live moment. See that method's own comment on this same call.
    this.referralsService.recordFirstApprovedAdIfReferred(listing.ownerId).catch(() => undefined);
    return this.toDetailDto(listing, undefined, true);
  }

  /** Admin override of `status` (active/sold/rented/deactivated) — the owner-facing `update()`
   * above deliberately forbids anyone but the listing's own owner from changing it; this is the
   * one legitimate way around that, for support cases (e.g. an owner deactivated by mistake and
   * can't be reached to fix it themselves). Always called through AdminService.setListingStatus,
   * which posts an explanation into the moderation thread — never silent, same principle as
   * flag()/approve() above. */
  async setStatusAsAdmin(id: string, status: ListingStatus, adminId: string): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({
      where: { id },
      select: { status: true },
    });
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (existing && existing.status !== status) {
      await this.logEdit(id, 'admin', adminId, 'status_changed', {
        status: { before: existing.status, after: status },
      });
    }
    return this.toDetailDto(listing, undefined, true);
  }

  /** A flagged listing (taken down for review — see `flag()`) 404s for everyone except its own
   * owner and admins, same as if it didn't exist — otherwise anyone who already had the direct
   * link (e.g. shared before moderation caught it) could keep viewing the flagged photos/content
   * even though it's been pulled from browse/search. */
  async findOne(
    id: string,
    currentUser?: { id: string; role: UserRole },
  ): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);

    const isOwnerOrAdmin =
      currentUser?.id === listing.ownerId || currentUser?.role === 'admin';
    if (listing.moderationState === 'flagged' && !isOwnerOrAdmin) {
      throw new NotFoundException(`Listing ${id} not found`);
    }
    if (listing.publishState !== 'live' && !isOwnerOrAdmin) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    const favouritedIds = await this.getFavouritedIds(currentUser?.id, [id]);
    const revealState = await this.contactRevealService.getRevealState(
      currentUser?.id ?? null,
      id,
      listing.owner.phone,
      listing.owner.email,
      listing.claimContact?.phone ?? null,
      listing.claimContact?.email ?? null,
    );
    // Ownership is passed separately from isOwnerOrAdmin: an admin looking at someone else's
    // listing is not its owner and may well need the contact actions, so the two cannot share a
    // flag even though they are computed a line apart.
    const dto = this.toDetailDto(
      listing,
      favouritedIds,
      isOwnerOrAdmin,
      currentUser?.id === listing.ownerId,
      revealState,
    );
    if (currentUser?.role === 'admin' && listing.claimPhoneE164) {
      return { ...dto, assisted: await this.assistedInfo(listing) };
    }
    return dto;
  }

  /** Lean counterpart to findOne, for generateMetadata's independent second fetch — see
   * ListingMetaDto's own doc comment for why this exists. Public/anonymous only: no
   * favouritedIds/revealState/isOwnerOrAdmin resolution, and a flagged listing 404s exactly like
   * findOne does for a non-owner/admin (no currentUser here, so that's every caller), so a
   * flagged listing can't leak real metadata into search results independent of the page itself
   * already 404ing for it. */
  async findMetaById(id: string): Promise<ListingMetaDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        city: { select: { name: true } },
        area: { select: { name: true } },
        listingPhotos: {
          orderBy: [{ displayOrder: 'asc' }, { photoNo: 'asc' }],
          take: 1,
        },
      },
    });
    if (!listing || listing.moderationState === 'flagged' || listing.publishState !== 'live') {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    const firstPhoto = listing.listingPhotos[0];
    return {
      id: listing.id,
      slug: listing.slug,
      category: listing.category,
      transactionType: listing.transactionType,
      cityName: listing.city.name,
      area: listing.area.name,
      title: listing.title,
      price: this.formatListingPrice(listing),
      priceQualifier: listing.price === 0 ? '' : listing.priceQualifier,
      priceOnRequest: listing.price === 0,
      description: listing.description,
      specs: cardSpecs(listing),
      ogImage: firstPhoto
        ? publicVariantUrl(this.cdnBase(), listing.id, firstPhoto.photoNo, 'full', firstPhoto.updatedAt)
        : null,
    };
  }

  private async runPostLiveSideEffects(
    listing: Listing & { city: City; area: Area },
    owner: {
      email: string | null;
      phone: string | null;
      acquisitionGclid: string | null;
    } | null,
    trackingAuthorized: boolean | undefined,
    ownerId: string,
    isBulkImportOwner = owner?.phone === BULK_IMPORT_OWNER_PHONE,
    /** The visitor's analytics session, if this call came from a real browser/app post rather
     * than outreach/admin — see CreateListingInput.sessionId's own doc comment for why this,
     * rather than the client, is what records /post/success now. */
    sessionId?: string,
  ): Promise<void> {
    if (sessionId) {
      this.analyticsService
        .recordPageView({ sessionId, path: '/post/success' })
        .catch(() => undefined);
    }

    this.savedSearchesService.notifyMatchingBuyers(listing).catch(() => undefined);

    if (
      trackingAuthorized !== false &&
      !isBulkImportOwner &&
      (owner?.acquisitionGclid || owner?.email || owner?.phone)
    ) {
      void this.googleAdsConversionProvider
        .uploadClickConversion({
          gclid: owner!.acquisitionGclid ?? undefined,
          conversionActionId: POST_AD_SUCCESS_CONVERSION_ACTION_ID,
          transactionId: `listing-${listing.id}`,
          eventTimestamp: listing.publishedAt ?? listing.createdAt,
          email: owner!.email,
          phone: owner!.phone,
          // Phase 2 of the conversion-value model (docs/plans/server-side-google-ads-conversion-
          // upload.md) — expected revenue per poster in this category/transactionType, not a ₹0
          // placeholder. Target CPA bidding (what every poster campaign actually uses today)
          // optimizes toward conversion count, not value, so this is purely observational for now
          // — visible in the Ads UI, not yet driving bids. See post-ad-value.ts's own doc comment.
          value: postAdValueRupees(listing.category, listing.transactionType),
          currency: 'INR',
        })
        .catch(() => undefined);
    }

    if (!isBulkImportOwner && owner) {
      this.notificationsService
        .notifyListingPosted(
          owner,
          {
            id: listing.id,
            slug: listing.slug,
            category: listing.category,
            transactionType: listing.transactionType,
            cityName: listing.city.name,
            area: listing.area.name,
            title: listing.title,
          },
          listing.ownerId,
        )
        .then((result) => {
          if (!result) return;
          return this.prisma.listingNotificationLog.create({
            data: {
              listingId: listing.id,
              kind: 'posted',
              channel: result.channel,
              providerMessageId: result.messageId ?? null,
            },
          });
        })
        .catch(() => undefined);
    }

    // Facebook Page cross-post (docs/plans/facebook-page-publishing.md) — every live listing,
    // unconditionally (unlike the owner notification above, this isn't gated on having a real
    // owner on file: a bulk-imported listing is still a real ad on the site and still gets
    // shared). `formatListingPrice` is called here, not inside NotificationsService, because this
    // is the only place that already has the category's per-unit area-field config in hand.
    this.notificationsService
      .publishToFacebookPage({
        id: listing.id,
        slug: listing.slug,
        category: listing.category,
        transactionType: listing.transactionType,
        cityName: listing.city.name,
        area: listing.area.name,
        title: listing.title,
        priceText:
          this.formatListingPrice(listing) +
          (listing.price === 0 ? '' : ` ${listing.priceQualifier}`),
      })
      .then((result) => {
        if (!result) return;
        return this.prisma.listingNotificationLog.create({
          data: {
            listingId: listing.id,
            kind: 'posted',
            channel: result.channel,
            providerMessageId: result.messageId ?? null,
          },
        });
      })
      .catch(() => undefined);

    // Referral program, Phase 3 (docs/plans/bhavano-referral-program-implementation.md) — a no-op
    // for the overwhelming majority of listings (no referral on file for this owner at all), and
    // itself a no-op past the referred user's first-ever approved ad. Fire-and-forget, same
    // reasoning as every other side effect in this method.
    this.referralsService.recordFirstApprovedAdIfReferred(ownerId).catch(() => undefined);
  }

  /** Idempotent — flips `pending_checkout` → `live` and runs deferred post-live side effects. */
  async completePendingPublish(listingId: string, trackingAuthorized?: boolean): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (!listing || listing.publishState === 'live') return;

    const publishedAt = new Date();
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { publishState: 'live', publishedAt },
    });

    const owner = await this.prisma.user.findUnique({
      where: { id: listing.ownerId },
      select: {
        deletedAt: true,
        name: true,
        email: true,
        phone: true,
        acquisitionGclid: true,
      },
    });
    if (owner?.deletedAt) return;

    const liveListing = { ...listing, publishState: 'live' as const, publishedAt };
    const isBulkImportOwner = owner?.phone === BULK_IMPORT_OWNER_PHONE;
    await this.runPostLiveSideEffects(
      liveListing,
      owner,
      trackingAuthorized,
      listing.ownerId,
      isBulkImportOwner,
    );
  }

  /** Publishing needs a *verified* phone: buyers reach a seller by phone, and a proven number is
   * what deters throwaway spam ads. Login no longer requires one (name + optional city only —
   * docs/plans/post-login-name-and-city.md), so a Google/Apple account can reach Publish without
   * it; the client asks for it there, and this is the authoritative backstop. Called by the
   * user-facing create route only — not by `create` itself, which outreach also uses to post on
   * behalf of a contact who has no account phone. `code` lets a client tell this apart from any
   * other 403 without matching the message text. */
  async assertOwnerPhoneVerified(ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { phone: true, phoneVerifiedAt: true },
    });
    if (!owner?.phone || !owner.phoneVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PHONE_VERIFICATION_REQUIRED',
        message: 'Verify your phone number to publish your ad.',
      });
    }
  }

  async create(
    rawInput: CreateListingInput,
    ownerId: string,
    trackingAuthorized?: boolean,
    assisted?: AssistedCreateOptions,
    // Only createListingFromContact sets this — a scraped Google Places business often has just
    // one downloaded photo, not the normal MIN_PHOTOS a real seller's wizard enforces. The claiming
    // owner can add more once it's theirs, same "fix it later" treatment as the attribute defaults
    // in createListingFromContact itself.
    skipMinPhotos?: boolean,
  ): Promise<ListingDetailDto> {
    // An assisted listing is hidden until claimed, so nothing that belongs to going live applies
    // yet: no checkout, no session trail. Videos are left for the seller to add once it's theirs,
    // since the Bulk Import account's Agent Pro would otherwise lift the video limit.
    const input: CreateListingInput = assisted
      ? { ...rawInput, checkoutIntent: undefined, videos: [], sessionId: undefined, claimContactId: undefined }
      : rawInput;
    if (!skipMinPhotos && input.photos.length < MIN_PHOTOS)
      throw new BadRequestException(`At least ${MIN_PHOTOS} photos are required`);
    if (input.photos.length > MAX_PHOTOS)
      throw new BadRequestException(`No more than ${MAX_PHOTOS} photos are allowed`);
    // A token issued before the owner deleted their account still authenticates for up to an
    // hour (stateless JWT, DB-free AuthGuard), and this is the one path that would attach new
    // data to a deleted account. name/email/phone ride along on this same fetch for
    // notifyListingPosted at the bottom of this method, rather than a second query for them.
    // acquisitionGclid rides along too, for the Post ad success conversion upload — see
    // docs/plans/server-side-google-ads-conversion-upload.md.
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        deletedAt: true,
        name: true,
        email: true,
        phone: true,
        acquisitionGclid: true,
        sellerType: true,
      },
    });
    if (owner?.deletedAt) {
      throw new UnauthorizedException('This account was deleted');
    }

    // A retried submission of the exact same client-generated draft id — most commonly "Post ad"
    // tapped again after a cancelled publish checkout, since the wizard (web and mobile) keeps the
    // same id across every attempt on one draft. Without this, the retry's INSERT collides on the
    // primary key and crashes with a raw Prisma unique-constraint error, which nothing catches —
    // it surfaces to the advertiser as a bare "Internal server error" and the listing never goes
    // live. Handing back what already exists instead is correct either way: it's the same draft.
    const existing = await this.prisma.listing.findUnique({
      where: { id: input.id },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (existing) {
      if (existing.ownerId !== ownerId) {
        throw new BadRequestException('This listing could not be created. Please try again.');
      }
      return assisted
        ? { ...this.toDetailDto(existing, undefined, true, false), assisted: await this.assistedInfo(existing) }
        : this.toDetailDto(existing, undefined, true, true);
    }

    await this.listingSlotsService.assertCanPublish(ownerId);
    const inputAttributes = normalizeBrokerageAttributes(input.transactionType, input.attributes ?? {});
    // For an assisted listing the answer is the seller's, not the Bulk Import account's: it fills
    // the listing's own fromBroker here and reaches the seller's profile at claim time. Resolved
    // before validation (not after, like every other field normalizes) so a legitimately deferred
    // fromBroker — assisted creation always supplies claimSellerType, an account that already
    // answered Owner/Agent once doesn't have to answer again per listing — counts toward the
    // field's own required check below, instead of rejecting a value this same call is about to
    // fill in. fromBroker is a select field untouched by normalizeAttributes, so resolving it on
    // the raw attributes here and normalizing everything afterward (including this fill) changes
    // nothing about what gets validated for any other field.
    const declaredSellerType = resolveDeclaredSellerType(
      input.category,
      inputAttributes,
      assisted ? assisted.claimSellerType : input.postedAs,
      assisted ? null : (owner?.sellerType ?? null),
    );
    this.assertValidAttributes(
      input.category,
      input.transactionType,
      declaredSellerType.attributes,
    );
    const attributes = this.normalizeAttributes(input.category, declaredSellerType.attributes);
    this.assertValidPriceQualifier(
      input.category,
      input.transactionType,
      input.priceQualifier,
    );
    const resolvedPrice = this.resolveListingPrice(
      input.category,
      input.transactionType,
      input.price,
      input.priceUnit,
      attributes,
    );
    this.assertValidPrice(input.category, resolvedPrice.price);
    this.assertPriceInRange(input.category, input.transactionType, input.price, resolvedPrice);
    this.assertBrokerageFitsPrice(input.transactionType, resolvedPrice.price, attributes);

    const moderation = await this.moderationService.moderate({ ...input, price: resolvedPrice.price }, ownerId);
    if (!moderation.ok) {
      // Structured, not just a plain message, when it's the duplicate-photo case — see
      // DuplicatePhotoErrorBody's own doc comment — so the client can point at exactly which
      // photo(s) to remove instead of the seller guessing which of up to MAX_PHOTOS it was.
      if (moderation.duplicatePhotoNos?.length) {
        throw new BadRequestException({
          code: 'DUPLICATE_PHOTO',
          message: moderation.reason,
          duplicatePhotoNos: moderation.duplicatePhotoNos,
        } satisfies DuplicatePhotoErrorBody);
      }
      throw new BadRequestException(moderation.reason);
    }

    const areaId =
      input.areaId ??
      (await this.locationsService.ensureArea(input.cityId, input.areaName)).id;
    const expiresAt = new Date(
      Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    const platformFeeSettings = await this.platformFeeSettingsService.getSettings();
    const wantsBoost = input.checkoutIntent?.boostDays !== undefined;
    if (input.checkoutIntent?.includeInstantAlerts && !wantsBoost) {
      throw new BadRequestException('Instant Alerts requires a Boost selection at publish time');
    }
    // Admin kill-switch: go live even when fee/boost would normally hold the ad in pending_checkout.
    const pendingCheckout =
      !platformFeeSettings.allowLivePublishWithPendingPayment &&
      (platformFeeApplies(input.category, platformFeeSettings) || wantsBoost);
    const now = new Date();

    // Full mobiles in free text bypass contact-reveal — mask before persist so the stored
    // title/description never publish a dialable number. See docs/plans/mask-phones-in-listing-text.md.
    const title = scrubPhonesInText(input.title.trim());
    const description = input.description?.trim()
      ? scrubPhonesInText(input.description.trim())
      : null;

    const created = await this.prisma.listing.create({
      data: {
        id: input.id,
        category: input.category,
        transactionType: input.transactionType,
        price: resolvedPrice.price,
        priceUnit: resolvedPrice.priceUnit,
        priceQualifier: input.priceQualifier ?? '',
        title,
        slug: slugify(title),
        areaId,
        cityId: input.cityId,
        specs: input.specs ?? [],
        // Empty string normalised to null: "left blank" and "cleared" are the same thing here,
        // and a null keeps the "has a description" check a single test everywhere downstream.
        description,
        attributes: attributes as Prisma.InputJsonValue,
        tag: deriveTag(input),
        ownerId,
        expiresAt,
        lat: input.lat,
        lng: input.lng,
        claimContactId: input.claimContactId ?? null,
        ...(assisted
          ? {
              publishState: 'awaiting_claim' as const,
              publishedAt: null,
              claimPhoneE164: assisted.claimPhoneE164,
              claimName: assisted.claimName,
              claimSellerType: assisted.claimSellerType,
              createdByAdminId: assisted.adminId,
              adminReviewed: true,
            }
          : {
              publishState: pendingCheckout ? ('pending_checkout' as const) : ('live' as const),
              publishedAt: pendingCheckout ? null : now,
            }),
        // A post-creation addPhoto atomically increments this — see the field's own doc comment
        // in schema.prisma for why it must start at least as high as any photoNo already in use.
        photoNoCounter: Math.max(0, ...input.photos.map((p) => p.photoNo)),
      },
    });

    if (declaredSellerType.saveToProfile && !assisted) {
      const sellerType = declaredSellerType.saveToProfile;
      await this.prisma.user.update({
        where: { id: ownerId },
        data: {
          sellerType,
          ...(sellerType === 'owner' ? { agencyName: null, reraNumber: null, reraVerifiedAt: null } : {}),
        },
      });
    }

    await this.prisma.listingPhoto.createMany({
      data: input.photos.map((p) => ({
        listingId: created.id,
        photoNo: p.photoNo,
        hash: p.hash,
        // Starts equal to photoNo (upload order) — the owner's first photo is the cover until
        // someone explicitly picks another. See ListingPhoto.displayOrder's own doc comment.
        displayOrder: p.photoNo,
      })),
    });
    const variants = Object.keys(PHOTO_VARIANTS) as PhotoVariant[];
    await this.prisma.photoVariantJob.createMany({
      data: input.photos.flatMap((p) =>
        variants.map((variant) => ({
          listingId: created.id,
          photoNo: p.photoNo,
          ext: p.ext,
          variant,
        })),
      ),
    });

    // Video never blocks a post — trim silently rather than reject the whole listing, since
    // entitlement (agentProUntil) can lapse between the uploads and this call and video is
    // optional (unlike photos, required above). No listing exists yet at this point, so only an
    // active Agent Pro subscription can elevate the limit — a boost is impossible pre-creation.
    const acceptedVideos = this.acceptVideosForOwner(
      ownerId,
      input.videos ?? [],
    );
    const videos = await acceptedVideos;
    if (videos.length > 0) {
      await this.prisma.listingVideo.createMany({
        data: videos.map((v, index) => ({
          listingId: created.id,
          videoNo: index + 1,
          storageId: v.storageId,
          ext: v.ext,
          durationSec: v.durationSec,
          sizeBytes: v.sizeBytes,
        })),
      });
    }

    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: created.id },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });

    const isBulkImportOwner = owner?.phone === BULK_IMPORT_OWNER_PHONE;

    if (!pendingCheckout && !assisted) {
      await this.runPostLiveSideEffects(
        listing,
        owner,
        trackingAuthorized,
        ownerId,
        isBulkImportOwner,
        input.sessionId,
      );
    }

    if (assisted) {
      await this.logEdit(listing.id, 'admin', assisted.adminId, 'created', null);
      const dto = this.toDetailDto(listing, undefined, true, false);
      return { ...dto, assisted: await this.assistedInfo(listing) };
    }
    await this.logEdit(listing.id, isBulkImportOwner ? 'system' : 'owner', ownerId, 'created', null);

    return this.toDetailDto(listing, undefined, true, true);
  }

  /** Admin-assisted posting: `create` under the Bulk Import account, hidden until the seller
   * behind `claimPhone` claims it. The seller's own limits are checked at claim time instead. */
  async createAssisted(
    input: CreateListingInput & { claimPhone: string; claimName: string; postedAs: SellerType },
    adminId: string,
  ): Promise<ListingDetailDto> {
    const claimPhoneE164 = toE164India(input.claimPhone);
    if (!claimPhoneE164) {
      throw new BadRequestException("The seller's phone must be a 10-digit Indian mobile number.");
    }
    if (input.postedAs !== 'owner' && input.postedAs !== 'agent') {
      throw new BadRequestException('Choose whether the seller is the owner or an agent.');
    }
    if (!input.claimName?.trim()) {
      throw new BadRequestException("Enter the seller's name.");
    }
    const bulkImportOwner = await this.prisma.user.findUnique({
      where: { phone: BULK_IMPORT_OWNER_PHONE },
      select: { id: true },
    });
    if (!bulkImportOwner) {
      throw new BadRequestException('The Bulk Import account is missing. Run prisma:seed:bulk-import-owner.');
    }
    const listingInput: CreateListingInput & Partial<typeof input> = { ...input, postedAs: undefined };
    delete listingInput.claimPhone;
    delete listingInput.claimName;
    return this.create(listingInput, bulkImportOwner.id, false, {
      claimPhoneE164,
      claimName: input.claimName.trim(),
      claimSellerType: input.postedAs,
      adminId,
    });
  }

  private async assistedInfo(
    listing: Pick<Listing, 'id' | 'claimPhoneE164' | 'claimName' | 'claimSellerType' | 'createdByAdminId' | 'claimedAt'>,
  ): Promise<AssistedListingInfoDto | undefined> {
    if (!listing.claimPhoneE164) return undefined;
    const admin = listing.createdByAdminId
      ? await this.prisma.user.findUnique({ where: { id: listing.createdByAdminId }, select: { name: true } })
      : null;
    return {
      claimPhone: listing.claimPhoneE164,
      claimName: listing.claimName,
      claimSellerType: listing.claimSellerType,
      preparedByName: admin?.name ?? null,
      claimUrl: assistedClaimUrl(this.siteUrl(), listing.id),
      claimedAt: listing.claimedAt?.toISOString() ?? null,
    };
  }

  private siteUrl(): string {
    return this.config.get<string>('PUBLIC_SITE_URL') ?? 'https://www.bhavano.com';
  }

  /** Trims a wizard-submitted videos array down to what the owner is currently entitled to
   * (agentPro-only, since no listing exists yet to check a boost against) — never throws, so a
   * lapsed entitlement between upload and submit degrades to fewer videos, not a rejected post. */
  private async acceptVideosForOwner(
    ownerId: string,
    videos: CreatedVideoInput[],
  ): Promise<CreatedVideoInput[]> {
    if (videos.length === 0) return [];
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { agentProUntil: true },
    });
    const entitlement = resolveVideoEntitlement(owner);
    return videos
      .filter((v) => v.durationSec <= entitlement.maxDurationSec)
      .slice(0, entitlement.maxVideos);
  }

  /** Adds a video to an already-existing listing — exists because boosting (which can elevate
   * the video entitlement) only ever happens after a listing already exists. `videoNo` is
   * server-computed (existing max + 1); a P2002 unique-constraint retry covers the one realistic
   * race (two concurrent adds from a double-click), no transaction needed. See
   * docs/plans/listing-video-uploads.md. addPhoto below is photos' counterpart, added later once
   * photos stopped being immutable post-creation. */
  async addVideo(
    listingId: string,
    ownerId: string,
    input: CreatedVideoInput,
  ): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { listingVideos: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== ownerId)
      throw new ForbiddenException("You don't own this listing");

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
      select: { agentProUntil: true },
    });
    const entitlement = resolveVideoEntitlement(owner, listing);
    if (listing.listingVideos.length >= entitlement.maxVideos) {
      throw new BadRequestException(
        entitlement.canUpgradeByBoosting
          ? 'Boost this listing to add up to 3 videos, up to 2 minutes each.'
          : `You've added the maximum of ${entitlement.maxVideos} videos. Delete one to add another.`,
      );
    }
    if (input.durationSec > entitlement.maxDurationSec) {
      throw new BadRequestException(
        `This video is longer than the ${entitlement.maxDurationSec}s limit for this listing`,
      );
    }

    const nextVideoNo =
      Math.max(0, ...listing.listingVideos.map((v) => v.videoNo)) + 1;
    try {
      await this.prisma.listingVideo.create({
        data: {
          listingId,
          videoNo: nextVideoNo,
          storageId: input.storageId,
          ext: input.ext,
          durationSec: input.durationSec,
          sizeBytes: input.sizeBytes,
        },
      });
    } catch (error) {
      // Concurrent add from a double-click landed first on the same videoNo — retry once with a
      // freshly-recomputed number rather than failing the request outright.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.prisma.listingVideo.create({
          data: {
            listingId,
            videoNo: nextVideoNo + 1,
            storageId: input.storageId,
            ext: input.ext,
            durationSec: input.durationSec,
            sizeBytes: input.sizeBytes,
          },
        });
      } else {
        throw error;
      }
    }

    await this.logEdit(listingId, 'owner', ownerId, 'video_added', null);

    return this.getMine(ownerId, listingId);
  }

  /** Always allowed regardless of current entitlement — an owner who's over quota after a lapsed
   * boost/subscription must still be able to remove a video. Deletes the row immediately (that's
   * what the user sees); the R2 objects are best-effort fire-and-forget, harmless if it fails
   * since storage keys are opaque and write-once (see ListingVideo.storageId). */
  async deleteVideo(
    listingId: string,
    ownerId: string,
    videoId: string,
  ): Promise<ListingDetailDto> {
    const video = await this.prisma.listingVideo.findUnique({
      where: { id: videoId },
    });
    if (!video || video.listingId !== listingId)
      throw new NotFoundException(`Video ${videoId} not found`);

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== ownerId)
      throw new ForbiddenException("You don't own this listing");

    await this.prisma.listingVideo.delete({ where: { id: videoId } });
    Promise.all([
      this.storage.deleteObject(videoTranscodedKey(listingId, video.storageId)),
      this.storage.deleteObject(videoPosterKey(listingId, video.storageId)),
    ]).catch(() => undefined);

    await this.logEdit(listingId, 'owner', ownerId, 'video_removed', null);

    return this.getMine(ownerId, listingId);
  }

  /** Adds a photo to an already-existing listing — photos' counterpart to addVideo above, added
   * later once photos stopped being immutable post-creation.
   *
   * `photoNo` is claimed via `Listing.photoNoCounter` ({ increment: 1 }, atomic, no race window)
   * rather than `Math.max(existing photoNo) + 1` the way addVideo computes `videoNo` — unlike
   * `videoNo`, `photoNo` is baked into this listing's R2 storage keys and `ListingPhoto` rows are
   * hard-deleted with no tombstone, so a max-over-current-rows approach would silently reissue a
   * deleted photo's number once any delete has ever happened. See photoNoCounter's own doc
   * comment in schema.prisma.
   *
   * Validation (cap, duplicate hash) happens before the counter is incremented, so a rejected
   * request never burns a number. If the R2 write below throws after the counter already
   * advanced, that's an intentionally harmless gap — the number is simply never reused, same as
   * any other skipped one — and no DB rows exist yet, so the request is safe to retry. */
  async addPhoto(
    listingId: string,
    ownerId: string,
    file: Express.Multer.File,
  ): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { listingPhotos: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== ownerId)
      throw new ForbiddenException("You don't own this listing");

    if (listing.listingPhotos.length >= MAX_PHOTOS) {
      throw new BadRequestException(
        `You've added the maximum of ${MAX_PHOTOS} photos. Delete one to add another.`,
      );
    }

    const hash = await computeDHash(file.buffer);
    if (await this.moderationService.isDuplicatePhotoHash(hash, listing.cityId, ownerId)) {
      throw new BadRequestException(
        'This photo appears to already be in use on another listing',
      );
    }
    const ext = extFromMimeType(file.mimetype);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { photoNoCounter: { increment: 1 } },
    });
    const nextPhotoNo = updated.photoNoCounter;

    await this.storage.putObject(
      originalKey(listingId, nextPhotoNo, ext),
      file.buffer,
      file.mimetype,
    );

    const variants = Object.keys(PHOTO_VARIANTS) as PhotoVariant[];
    await this.prisma.$transaction([
      this.prisma.listingPhoto.create({
        data: {
          listingId,
          photoNo: nextPhotoNo,
          hash,
          // Appended at the end — never auto-promoted to cover. The owner uses the existing
          // "set cover" control if they want the new photo to lead.
          displayOrder: nextPhotoNo,
        },
      }),
      this.prisma.photoVariantJob.createMany({
        data: variants.map((variant) => ({
          listingId,
          photoNo: nextPhotoNo,
          ext,
          variant,
        })),
      }),
    ]);

    await this.logEdit(listingId, 'owner', ownerId, 'photo_added', null);

    return this.getMine(ownerId, listingId);
  }

  /** Always allowed, mirroring deleteVideo's own "regardless of quota" rule — nothing about
   * photos has a quota-lapse concept, but there's equally no reason to ever block removing one.
   * `PhotoVariantJob.ext` is read before anything is deleted — ListingPhoto itself has no `ext`
   * column, so this is the only place the original's R2 key can still be reconstructed. Job rows
   * are deleted (not reset), so the processing poller's own `status:'processing'` completion
   * guard simply matches zero rows if a job was mid-flight when this ran — no orphan writes. */
  async deletePhoto(
    listingId: string,
    ownerId: string,
    photoNo: number,
  ): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== ownerId)
      throw new ForbiddenException("You don't own this listing");

    const photo = await this.prisma.listingPhoto.findUnique({
      where: { listingId_photoNo: { listingId, photoNo } },
    });
    if (!photo) throw new NotFoundException(`Photo ${photoNo} not found`);

    const jobs = await this.prisma.photoVariantJob.findMany({
      where: { listingId, photoNo },
      select: { ext: true },
    });

    await this.prisma.$transaction([
      this.prisma.listingPhoto.delete({
        where: { listingId_photoNo: { listingId, photoNo } },
      }),
      this.prisma.photoVariantJob.deleteMany({ where: { listingId, photoNo } }),
    ]);

    const keysToDelete = [
      variantKey(listingId, photoNo, 'preview'),
      variantKey(listingId, photoNo, 'full'),
    ];
    if (jobs[0]?.ext) keysToDelete.push(originalKey(listingId, photoNo, jobs[0].ext));
    Promise.all(keysToDelete.map((key) => this.storage.deleteObject(key))).catch(() => undefined);

    const cdnBase = this.cdnBase();
    this.cdnPurge
      .purgeUrls([
        variantUrl(cdnBase, listingId, photoNo, 'preview'),
        variantUrl(cdnBase, listingId, photoNo, 'full'),
      ])
      .catch(() => undefined);

    await this.logEdit(listingId, 'owner', ownerId, 'photo_removed', null);

    return this.getMine(ownerId, listingId);
  }

  /** Admin hard-delete: drop the Listing row and everything that hangs off it, and purge its R2
   * photo/video objects plus their CDN copies. Unlike an owner's "deactivate" or admin's "flag",
   * nothing is left behind.
   *
   * - Payments are financial history — they are unlinked (`listingId` → null), never deleted.
   * - `PhotoVariantJob` has no FK to Listing (jobs outlive the upload step), so it's cleared here.
   * - Any other listing pointing at this one via `relatedListingId` (a bare string, no FK) is
   *   nulled so it doesn't dangle.
   * - Everything else — photos, videos, views, favourites, conversations + their messages,
   *   boosts, renewals, notification logs, contact reveals — is `onDelete: Cascade` and goes
   *   with the row.
   * - R2 deletes + CDN purges are best-effort fire-and-forget (same as deletePhoto/deleteVideo):
   *   the keys are listing-scoped, so a missed object can never collide with anything else — it
   *   just sits until an R2 lifecycle rule reaps it. Video *originals* live under a
   *   `videos/originals/<listingId>/` prefix that already has such a rule, so they're not
   *   enumerated here.
   */
  async deleteCompletely(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        listingPhotos: { select: { photoNo: true } },
        listingVideos: { select: { storageId: true } },
      },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);

    // Referral program BR-5 (docs/plans/bhavano-referral-program-implementation.md, Phase 3) —
    // fire-and-forget, before the delete itself so it still fires even if something later in this
    // method throws partway through.
    this.referralsService
      .revokeIfTakenDown(listing.ownerId, 'Listing deleted')
      .catch(() => undefined);

    const jobExts = await this.prisma.photoVariantJob.findMany({
      where: { listingId },
      select: { photoNo: true, ext: true },
    });
    const extByPhotoNo = new Map(jobExts.map((j) => [j.photoNo, j.ext]));

    const cdnBase = this.cdnBase();
    const r2Keys: string[] = [];
    const cdnUrls: string[] = [];
    for (const { photoNo } of listing.listingPhotos) {
      r2Keys.push(variantKey(listingId, photoNo, 'preview'), variantKey(listingId, photoNo, 'full'));
      const ext = extByPhotoNo.get(photoNo);
      if (ext) r2Keys.push(originalKey(listingId, photoNo, ext));
      cdnUrls.push(
        variantUrl(cdnBase, listingId, photoNo, 'preview'),
        variantUrl(cdnBase, listingId, photoNo, 'full'),
      );
    }
    for (const { storageId } of listing.listingVideos) {
      r2Keys.push(videoTranscodedKey(listingId, storageId), videoPosterKey(listingId, storageId));
      cdnUrls.push(
        videoUrl(cdnBase, listingId, storageId),
        videoPosterUrl(cdnBase, listingId, storageId),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { listingId }, data: { listingId: null } });
      await tx.photoVariantJob.deleteMany({ where: { listingId } });
      await tx.listing.updateMany({
        where: { relatedListingId: listingId },
        data: { relatedListingId: null },
      });
      await tx.listing.delete({ where: { id: listingId } });
    });

    Promise.all(r2Keys.map((key) => this.storage.deleteObject(key))).catch(() => undefined);
    this.cdnPurge.purgeUrls(cdnUrls).catch(() => undefined);

    this.logger.log(
      `Listing ${listingId} hard-deleted (${listing.listingPhotos.length} photos, ${listing.listingVideos.length} videos purged)`,
    );
  }

  async listMine(userId: string): Promise<ListingDetailDto[]> {
    const listings = await this.prisma.listing.findMany({
      where: { ownerId: userId },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
      orderBy: { createdAt: 'desc' },
    });

    const interestCounts =
      listings.length === 0
        ? []
        : await this.prisma.listingInterest.groupBy({
            by: ['listingId'],
            where: { listingId: { in: listings.map((l) => l.id) } },
            _count: { _all: true },
          });
    const interestByListing = new Map(interestCounts.map((r) => [r.listingId, r._count._all]));

    return listings.map((listing) => {
      const dto = this.toDetailDto(listing, undefined, true, true);
      dto.interestCount = interestByListing.get(listing.id) ?? 0;
      return dto;
    });
  }

  /** Counts for post-login routing (pending publish checkout) and future seller banners. */
  async getSellerAttention(userId: string): Promise<SellerAttentionDto> {
    const now = new Date();
    const renewAttentionBy = new Date(
      now.getTime() + LISTING_RENEW_ATTENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const ownerWhere = { ownerId: userId };

    const [pendingCheckoutCount, activeListingCount, expiringWithinDaysCount] =
      await Promise.all([
        this.prisma.listing.count({
          where: { ...ownerWhere, publishState: 'pending_checkout' },
        }),
        this.prisma.listing.count({
          where: { ...ownerWhere, status: 'active' },
        }),
        this.prisma.listing.count({
          where: {
            ...ownerWhere,
            status: 'active',
            expiresAt: { lte: renewAttentionBy },
          },
        }),
      ]);

    let pendingCheckoutListingId: string | null = null;
    if (pendingCheckoutCount === 1) {
      const pending = await this.prisma.listing.findFirst({
        where: { ...ownerWhere, publishState: 'pending_checkout' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      pendingCheckoutListingId = pending?.id ?? null;
    }

    return {
      pendingCheckoutCount,
      pendingCheckoutListingId,
      activeListingCount,
      expiringWithinDaysCount,
    };
  }

  async getMine(userId: string, id: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    if (listing.ownerId !== userId)
      throw new ForbiddenException("You don't own this listing");

    return this.toDetailDto(listing, undefined, true, true);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateListingDto,
  ): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);
    if (existing.ownerId !== userId)
      throw new ForbiddenException("You don't own this listing");

    return this.applyUpdate(id, existing, dto, 'owner', userId);
  }

  /** Admin override of a listing's own content — price, title, description, specs, attributes,
   * plus admin-only category/transactionType/cityId/areaId/areaName/lat/lng — on top of the
   * owner-only `update()` above. Same validation and the same ListingEditLog diff, just without
   * the ownership check and attributed to the admin instead of the owner. For support cases where
   * the owner can't be reached to fix something themselves (a typo in the title, a listing posted
   * under the wrong city/category), mirroring why setStatusAsAdmin exists for status specifically.
   * See docs/plans/admin-edit-location-and-category.md. */
  async updateAsAdmin(
    id: string,
    dto: AdminUpdateListingDto,
    adminId: string,
  ): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);

    return this.applyUpdate(id, existing, dto, 'admin', adminId);
  }

  private async applyUpdate(
    id: string,
    existing: Listing,
    dto: AdminUpdateListingDto,
    actorType: 'owner' | 'admin',
    actorId: string,
  ): Promise<ListingDetailDto> {
    // Only ever set by the admin route (AdminUpdateListingDto) — the owner-facing route binds to
    // plain UpdateListingDto, so these are always undefined for actorType === 'owner'.
    const nextCategory = dto.category ?? existing.category;
    const nextTransactionType = dto.transactionType ?? existing.transactionType;
    const categoryOrTxnChanged =
      nextCategory !== existing.category ||
      nextTransactionType !== existing.transactionType;

    // A category/transactionType swap invalidates the old attributes object (different required
    // fields, different allowed keys) — reset to the new category's defaults exactly like the
    // posting wizard does on a category change, unless the caller already sent a fresh attributes
    // object for the new category in the same request.
    const rawAttributes = dto.attributes
      ? normalizeBrokerageAttributes(nextTransactionType, dto.attributes)
      : categoryOrTxnChanged
        ? defaultAttributesFor(nextCategory)
        : undefined;
    if (rawAttributes !== undefined) {
      this.assertValidAttributes(
        nextCategory,
        nextTransactionType,
        rawAttributes,
      );
    }
    // Same normalisation the create path does — an edit must not put a string back into a column
    // the filter reads as a number. See normalizeAttributes.
    const attributesToValidate =
      rawAttributes === undefined
        ? undefined
        : this.normalizeAttributes(nextCategory, rawAttributes);

    // Price/price-qualifier legality (e.g. "Contact for price") depends on (category,
    // transactionType) too, so re-check them against the *new* pairing whenever either changes,
    // even if the caller didn't touch price/priceQualifier this request.
    const priceQualifierToValidate =
      dto.priceQualifier ??
      (categoryOrTxnChanged ? existing.priceQualifier : undefined);
    if (priceQualifierToValidate !== undefined) {
      this.assertValidPriceQualifier(
        nextCategory,
        nextTransactionType,
        priceQualifierToValidate,
      );
    }
    // Only resolved (multiplied by area) when `dto.price` is present in *this* request — never
    // re-derived from `existing.price`, which is already the stored total and would otherwise get
    // multiplied a second time. See resolveListingPrice's own doc comment.
    let resolvedPrice: { price: number; priceUnit: AreaUnit | null } | undefined;
    if (dto.price !== undefined) {
      const priceUnitForThisEdit =
        dto.priceUnit !== undefined ? dto.priceUnit : existing.priceUnit;
      resolvedPrice = this.resolveListingPrice(
        nextCategory,
        nextTransactionType,
        dto.price,
        priceUnitForThisEdit ?? undefined,
        attributesToValidate ?? ((existing.attributes as Record<string, unknown> | null) ?? {}),
      );
    } else if (dto.priceUnit === null) {
      // Explicitly clearing back to whole-price with no new number submitted — keep the
      // currently-stored total as-is, just drop the per-unit flag.
      resolvedPrice = { price: existing.price, priceUnit: null };
    }

    const priceToValidate =
      resolvedPrice?.price ?? (categoryOrTxnChanged ? existing.price : undefined);
    if (priceToValidate !== undefined) {
      this.assertValidPrice(nextCategory, priceToValidate);
    }
    if (dto.price !== undefined && resolvedPrice && resolvedPrice.price !== existing.price) {
      this.assertPriceInRange(nextCategory, nextTransactionType, dto.price, resolvedPrice);
    }
    // Only when this edit touches the fee or the price, so an unrelated edit (a title fix) isn't
    // blocked by a fee stored before these limits existed.
    if (attributesToValidate !== undefined || (resolvedPrice && resolvedPrice.price !== existing.price)) {
      this.assertBrokerageFitsPrice(
        nextTransactionType,
        resolvedPrice?.price ?? existing.price,
        attributesToValidate ?? ((existing.attributes as Record<string, unknown> | null) ?? {}),
      );
    }

    // City/area resolution — admin-only, and only when at least one of the three is present.
    // City and area always move together: an area belongs to exactly one city, so changing city
    // without saying where the listing now sits in it would leave a stale, cross-city area.
    let nextCityId = existing.cityId;
    let nextAreaId = existing.areaId;
    if (dto.cityId !== undefined || dto.areaId !== undefined || dto.areaName !== undefined) {
      nextCityId = dto.cityId ?? existing.cityId;
      if (dto.areaId !== undefined) {
        const area = await this.prisma.area.findUnique({ where: { id: dto.areaId } });
        if (!area || area.cityId !== nextCityId) {
          throw new BadRequestException('That area does not belong to the selected city');
        }
        nextAreaId = dto.areaId;
      } else if (dto.areaName !== undefined) {
        nextAreaId = (await this.locationsService.ensureArea(nextCityId, dto.areaName)).id;
      } else {
        throw new BadRequestException('areaId or areaName is required when changing city');
      }
    }

    // Same masking as create — owner and admin edits both persist the scrubbed text.
    const nextTitle =
      dto.title !== undefined ? scrubPhonesInText(dto.title.trim()) : undefined;
    const nextDescription =
      dto.description !== undefined
        ? dto.description.trim()
          ? scrubPhonesInText(dto.description.trim())
          : null
        : undefined;

    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(resolvedPrice !== undefined ? { price: resolvedPrice.price, priceUnit: resolvedPrice.priceUnit } : {}),
        ...(dto.priceQualifier !== undefined
          ? { priceQualifier: dto.priceQualifier }
          : {}),
        ...(nextTitle !== undefined
          ? { title: nextTitle, slug: slugify(nextTitle) }
          : {}),
        ...(dto.specs !== undefined ? { specs: dto.specs } : {}),
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        ...(attributesToValidate !== undefined
          ? { attributes: attributesToValidate as Prisma.InputJsonValue }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.transactionType !== undefined
          ? { transactionType: dto.transactionType }
          : {}),
        ...(nextCityId !== existing.cityId ? { cityId: nextCityId } : {}),
        ...(nextAreaId !== existing.areaId ? { areaId: nextAreaId } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        // An owner editing a flagged listing IS the resubmission — flip adminReviewed back
        // to false so it resurfaces in the admin queue as needing another look. Approving/
        // flagging again is still required to actually change moderationState. An admin editing
        // it is not a resubmission the same way, but there's no harm in the same flip — an admin
        // fixing a flagged listing's content is exactly the kind of thing that should resurface
        // for a second look too.
        ...(existing.moderationState === 'flagged'
          ? { adminReviewed: false }
          : {}),
      },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });

    const changes = diffFields(
      {
        price: existing.price,
        priceQualifier: existing.priceQualifier,
        title: existing.title,
        specs: existing.specs,
        description: existing.description,
        attributes: existing.attributes,
        status: existing.status,
        category: existing.category,
        transactionType: existing.transactionType,
        cityId: existing.cityId,
        areaId: existing.areaId,
        lat: existing.lat,
        lng: existing.lng,
      },
      {
        price: dto.price,
        priceQualifier: dto.priceQualifier,
        title: nextTitle,
        specs: dto.specs,
        description: nextDescription,
        attributes: attributesToValidate,
        status: dto.status,
        category: dto.category,
        transactionType: dto.transactionType,
        cityId: nextCityId !== existing.cityId ? nextCityId : undefined,
        areaId: nextAreaId !== existing.areaId ? nextAreaId : undefined,
        lat: dto.lat,
        lng: dto.lng,
      },
    );
    if (Object.keys(changes).length > 0) {
      await this.logEdit(id, actorType, actorId, 'updated', changes);
    }

    return this.toDetailDto(listing, undefined, true);
  }

  /** Pushes expiresAt forward by the same duration a fresh post gets — available from 7 days
   * before expiry (an early renewal stacks onto the remaining time) through any time after it has
   * already lapsed (where `max(now, expiresAt)` falls back to counting from today instead of the
   * past date). Gated by assertCanRenew rather than assertCanPublish: renewing a still-active
   * listing must not be blocked by a cap that listing is already counted inside. See
   * docs/plans/listing-expiry-renew-past-listings.md. */
  async renew(id: string, ownerId: string): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);
    if (existing.ownerId !== ownerId)
      throw new ForbiddenException("You don't own this listing");
    if (existing.status !== 'active') {
      throw new BadRequestException('Only an active listing can be renewed');
    }

    await this.listingSlotsService.assertCanRenew(ownerId, id);

    const newExpiresAt = new Date(
      Math.max(Date.now(), existing.expiresAt.getTime()) +
        DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    // Transactional so the audit row can never diverge from the expiry it claims to record.
    // The create is sequenced first so the update's include picks it up — otherwise the returned
    // DTO's renewCount would lag one behind the renewal that just happened.
    const [, listing] = await this.prisma.$transaction([
      this.prisma.listingRenewal.create({
        data: {
          listingId: id,
          previousExpiresAt: existing.expiresAt,
          newExpiresAt,
        },
      }),
      this.prisma.listing.update({
        where: { id },
        data: { expiresAt: newExpiresAt },
        include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
      }),
    ]);

    return this.toDetailDto(listing, undefined, true, true);
  }

  /** Transfers a bulk-imported listing (Listing.claimContactId set — see
   * bulk_upload_listings.py) to the real business owner, once they've proven they hold the
   * exact phone number Google/the scrape recorded for that business. One-shot: `claimedAt`
   * being already set means it was claimed before, by design (no re-claiming/hijacking a
   * listing once it's a real owner's). Not an ownership check like every other mutation here —
   * the whole point is transferring away from the Bulk Import account, not verifying against it. */
  async claimListing(listingId: string, userId: string, source?: ClaimSource): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { claimContact: { select: { phoneE164: true } } },
    });
    if (!existing) throw new NotFoundException(`Listing ${listingId} not found`);
    const claimPhoneE164 = existing.claimContact?.phoneE164 ?? existing.claimPhoneE164;
    if (!claimPhoneE164) {
      throw new BadRequestException('This listing is not claimable');
    }
    if (existing.claimedAt) {
      // The same person who already claimed this clicking the link again (a stale WhatsApp/
      // email message reopened, a double-tap) isn't an error at all — it's just "you're already
      // in", so this returns the listing exactly like a fresh claim would rather than throwing.
      // Only a genuinely different account hitting an already-claimed listing is a real conflict.
      if (existing.ownerId === userId) {
        return this.getMine(userId, listingId);
      }
      throw new ConflictException('This listing has already been claimed by someone else.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    const userPhoneE164 = toE164India(user?.phone);
    if (!userPhoneE164 || userPhoneE164 !== claimPhoneE164) {
      throw new ForbiddenException(
        existing.claimContactId
          ? "This phone number doesn't match the one on file for this business listing."
          : "This phone number doesn't match the one Bhavano has for this ad. Sign in with the number " +
              'you gave us, or reply to the message we sent you.',
      );
    }

    if (!existing.claimContactId) {
      return this.publishAssistedClaim(existing, userId, source ?? 'assisted');
    }

    const claimedAt = new Date();
    const [, , listing] = await this.prisma.$transaction([
      this.prisma.outreachContact.update({
        where: { id: existing.claimContactId },
        data: { userId },
      }),
      // Buyer enquiries sent before the claim went to the Bulk Import account; they're the new
      // owner's leads now.
      this.prisma.conversation.updateMany({
        where: { listingId, posterId: existing.ownerId, type: 'inquiry', inquirerId: { not: userId } },
        data: { posterId: userId },
      }),
      this.prisma.listing.update({
        where: { id: listingId },
        data: { ownerId: userId, claimedAt, claimSource: source },
        include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
      }),
    ]);

    return this.toDetailDto(listing, undefined, true, true);
  }

  /** The seller confirming an admin-assisted listing: it becomes theirs and goes live (or waits
   * on the platform fee, as their own post would). Their listing limit is checked here, not at
   * creation, when it was only checked against the Bulk Import account. */
  private async publishAssistedClaim(
    existing: Listing,
    userId: string,
    source: ClaimSource,
  ): Promise<ListingDetailDto> {
    if (existing.publishState !== 'awaiting_claim') {
      throw new BadRequestException('This listing is not claimable');
    }
    await this.listingSlotsService.assertCanPublish(userId);

    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, name: true, email: true, phone: true, acquisitionGclid: true, sellerType: true },
    });
    if (!owner || owner.deletedAt) throw new UnauthorizedException('This account was deleted');

    const platformFeeSettings = await this.platformFeeSettingsService.getSettings();
    const pendingCheckout =
      !platformFeeSettings.allowLivePublishWithPendingPayment &&
      platformFeeApplies(existing.category, platformFeeSettings);
    const now = new Date();

    // Conditional on still being unclaimed, so two sign-ins racing on the same link can't both win.
    const { count } = await this.prisma.listing.updateMany({
      where: { id: existing.id, claimedAt: null, publishState: 'awaiting_claim' },
      data: {
        ownerId: userId,
        claimedAt: now,
        claimSource: source,
        publishState: pendingCheckout ? 'pending_checkout' : 'live',
        publishedAt: pendingCheckout ? null : now,
        expiresAt: new Date(now.getTime() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    if (count === 0) {
      throw new ConflictException('This listing has already been claimed by someone else.');
    }

    if (!owner.sellerType && existing.claimSellerType) {
      await this.prisma.user.update({ where: { id: userId }, data: { sellerType: existing.claimSellerType } });
    }
    await this.logEdit(existing.id, 'owner', userId, 'claimed', {
      ownerId: { before: existing.ownerId, after: userId },
    });

    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: existing.id },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (!pendingCheckout) {
      // Staff typed this ad, so an ads conversion is only credited when the seller actually came
      // from an ad click, not matched on their email or phone alone.
      await this.runPostLiveSideEffects(listing, owner, owner.acquisitionGclid ? undefined : false, userId, false);
    }
    return this.toDetailDto(listing, undefined, true, true);
  }

  /** What the claim page shows before sign-in. Public: listing ids are unguessable, and the
   * contact phone is masked. */
  async getClaimPreview(listingId: string): Promise<ListingClaimPreviewDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        city: true,
        area: true,
        claimContact: { select: { phoneE164: true } },
        listingPhotos: { orderBy: [{ displayOrder: 'asc' }, { photoNo: 'asc' }], select: { photoNo: true, updatedAt: true } },
      },
    });
    const claimPhoneE164 = listing?.claimContact?.phoneE164 ?? listing?.claimPhoneE164;
    if (!listing || !claimPhoneE164) throw new NotFoundException(`Listing ${listingId} not found`);

    const cover = listing.listingPhotos[0];
    return {
      id: listing.id,
      kind: listing.claimContactId ? 'outreach' : 'assisted',
      claimed: listing.claimedAt !== null,
      title: listing.title,
      category: listing.category,
      transactionType: listing.transactionType,
      price: this.formatListingPrice(listing),
      priceQualifier: listing.price === 0 ? '' : listing.priceQualifier,
      cityName: listing.city.name,
      area: listing.area.name,
      specs: cardSpecs(listing),
      description: listing.description,
      photoUrl: cover ? publicVariantUrl(this.cdnBase(), listing.id, cover.photoNo, 'full', cover.updatedAt) : null,
      photoCount: listing.listingPhotos.length,
      maskedPhone: maskClaimPhone(claimPhoneE164),
      claimName: listing.claimName,
    };
  }

  /** Deletes admin-assisted listings nobody claimed within ASSISTED_CLAIM_DAYS, photos included. */
  async deleteExpiredAssistedListings(now = new Date()): Promise<number> {
    const stale = await this.prisma.listing.findMany({
      where: { publishState: 'awaiting_claim', claimedAt: null, createdAt: { lt: assistedClaimCutoff(now) } },
      select: { id: true },
    });
    for (const { id } of stale) {
      await this.deleteCompletely(id);
    }
    return stale.length;
  }

  /** Top (category, transactionType, city) combinations by real inventory — feeds the
   * "Popular searches" section below the search bar. There's no search-query telemetry to mine
   * (search is just a title filter, never logged), so this is the closest real signal: summed
   * `viewCount` across active listings in each bucket, which favors combinations people actually
   * look at over ones that merely have the most postings. `cityId` narrows this to one city's own
   * popular combinations (still grouped by cityId regardless, so this is just an extra `where`
   * clause, not a different query shape) — omit it for the site-wide ranking. */
  async getPopularSearches(
    limit = 6,
    cityId?: string,
  ): Promise<PopularSearchDto[]> {
    const groups = await this.prisma.listing.groupBy({
      by: ['category', 'transactionType', 'cityId'],
      where: {
        status: 'active',
        publishState: 'live',
        moderationState: 'approved',
        // No expiresAt gate — see docs/plans/explicit-close-not-auto-expire.md.
        ...(cityId ? { cityId } : {}),
      },
      _sum: { viewCount: true },
      _count: { _all: true },
      orderBy: { _sum: { viewCount: 'desc' } },
      take: limit,
    });
    if (groups.length === 0) return [];

    const cities = await this.prisma.city.findMany({
      where: { id: { in: [...new Set(groups.map((g) => g.cityId))] } },
    });
    const cityNameById = new Map(cities.map((c) => [c.id, c.name]));

    return groups
      .map((g) => ({
        cityName: cityNameById.get(g.cityId) ?? '',
        category: g.category,
        transactionType: g.transactionType,
        count: g._count._all,
      }))
      .filter((g): g is PopularSearchDto => g.cityName !== '');
  }

  /** Minimal fields for every active listing — feeds the web app's sitemap.xml. See
   * docs/plans/explicit-close-not-auto-expire.md — no expiresAt gate; a listing stays in the
   * sitemap until its own status changes, never just from age. */
  async findAllForSitemap(): Promise<ListingSitemapEntry[]> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        publishState: 'live',
        moderationState: 'approved',
      },
      include: { city: true, area: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });

    return listings.map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      category: listing.category,
      transactionType: listing.transactionType,
      cityName: listing.city.name,
      area: listing.area.name,
      updatedAt: listing.updatedAt.toISOString(),
    }));
  }

  /** Records every visit — who (logged-in user id or anonymous device key) and when. No dedup on
   * viewCount: it counts total visits, not unique viewers (see ListingView's own doc comment for
   * why this shape was chosen over deduping at write time). uniqueViewerCount is the one dedup
   * that does happen — incremented only the first time this exact viewerKey is seen for this
   * listing — see that field's own doc comment on Listing for the admin "organic views" use and
   * its known cross-device-before-login tradeoff. */
  async recordView(
    listingId: string,
    viewerKey: string,
  ): Promise<{ viewCount: number }> {
    const seenBefore = (await this.prisma.listingView.count({ where: { listingId, viewerKey } })) > 0;
    await this.prisma.listingView.create({ data: { listingId, viewerKey } });
    const listing = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        viewCount: { increment: 1 },
        ...(seenBefore ? {} : { uniqueViewerCount: { increment: 1 } }),
      },
      select: { viewCount: true },
    });
    return { viewCount: listing.viewCount };
  }

  /** The current count, without recording a visit — what the view endpoint answers for an admin. */
  async getViewCount(listingId: string): Promise<{ viewCount: number }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { viewCount: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return { viewCount: listing.viewCount };
  }

  /** A viewer who only ever logs in after browsing a while shouldn't have every owner go
   * un-notified just because the view happened before they signed in — but a ping about a view
   * from weeks ago reads as stale and confusing to the owner, not useful, so this only looks back
   * this far. Independent of INTEREST_RENOTIFY_MS, which governs re-notifying about the *same*
   * listing, not how far back a first-time retroactive notify reaches. */
  private static readonly ANONYMOUS_INTEREST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  /** Re-keys a visitor's pre-signup anonymous views (`anon:<viewerKey>`) onto their new account
   * (`user:<userId>`) once they sign up on the same device — the ListingView analogue of
   * AnalyticsService.linkVisitToUser — and retroactively runs recordInterest for every distinct
   * listing viewed anonymously in the last ANONYMOUS_INTEREST_WINDOW_MS, so those owners hear
   * about the visit too, not just the ones viewed after the login happened to land. recordInterest
   * already no-ops a listing seen within the last INTEREST_RENOTIFY_MS, so this never double-pings
   * one the normal logged-in-view path already notified about.
   *
   * The rename itself stays unbounded (every anonymous view ever, for complete analytics
   * attribution) — only the retroactive notify is windowed. Each listing is best-effort and
   * independent: the viewer's own listing, one that's gone off-market, or one since deleted is
   * skipped rather than failing the batch, since this is fire-and-forget from AuthService and must
   * never block login. */
  async linkListingViewsToUser(viewerKey: string, userId: string): Promise<void> {
    const since = new Date(Date.now() - ListingsService.ANONYMOUS_INTEREST_WINDOW_MS);
    const recentViews = await this.prisma.listingView.findMany({
      where: { viewerKey: `anon:${viewerKey}`, createdAt: { gte: since } },
      select: { listingId: true },
      distinct: ['listingId'],
    });

    await this.prisma.listingView.updateMany({
      where: { viewerKey: `anon:${viewerKey}` },
      data: { viewerKey: `user:${userId}` },
    });

    for (const { listingId } of recentViews) {
      try {
        await this.recordInterest(listingId, userId, 'view');
      } catch (err) {
        // Own listing, not live any more, or deleted since the anonymous view — not an error,
        // just nothing to notify.
        this.logger.debug(
          { err, listingId, userId },
          'Skipped retroactive interest for an anonymously-viewed listing',
        );
      }
    }
  }

  /** Flips the favourite, or with `desired` sets it: a save resumed after login, or synced from the
   * device, must never un-save a listing already saved on another device. */
  async toggleFavourite(
    listingId: string,
    userId: string,
    desired?: boolean,
  ): Promise<{ favourited: boolean; likeCount: number }> {
    const existing = await this.prisma.favourite.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });

    if (desired !== undefined && desired === !!existing) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { likeCount: true },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      return { favourited: desired, likeCount: listing.likeCount };
    }

    if (existing) {
      await this.prisma.favourite.delete({ where: { id: existing.id } });
      const listing = await this.prisma.listing.update({
        where: { id: listingId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { favourited: false, likeCount: listing.likeCount };
    }

    await this.prisma.favourite.create({ data: { listingId, userId } });
    const listing = await this.prisma.listing.update({
      where: { id: listingId },
      data: { likeCount: { increment: 1 } },
      select: {
        likeCount: true,
        title: true,
        ownerId: true,
        boostedUntil: true,
      },
    });

    // Push for every favourite of someone else's ad (mobile advertiser signal). Email/WhatsApp
    // stays boost-only inside notifyOwnerOfLike — unboosted likes as email would be noisy.
    const isBoosted = isListingBoosted(listing);
    if (listing.ownerId !== userId) {
      void this.notifyOwnerOfLike(listingId, listing.ownerId, userId, listing.title, isBoosted).catch(
        () => undefined,
      );
    }

    return { favourited: true, likeCount: listing.likeCount };
  }

  /** Saves the listings a visitor saved on their device before logging in. Skips ones that no
   * longer exist and the user's own; already-saved ones stay saved. Returns how many are saved. */
  async importFavourites(userId: string, listingIds: string[]): Promise<{ saved: number }> {
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: [...new Set(listingIds)] }, ownerId: { not: userId } },
      select: { id: true },
    });
    let saved = 0;
    for (const { id } of listings) {
      try {
        await this.toggleFavourite(id, userId, true);
        saved++;
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to import device save ${id} for ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { saved };
  }

  private async notifyOwnerOfLike(
    listingId: string,
    ownerId: string,
    likerId: string,
    listingTitle: string,
    isBoosted: boolean,
  ): Promise<void> {
    const [owner, liker, firstPhoto] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { email: true, phone: true },
      }),
      this.prisma.user.findUnique({
        where: { id: likerId },
        select: { name: true },
      }),
      this.prisma.listingPhoto.findFirst({
        where: { listingId },
        orderBy: [{ displayOrder: 'asc' }, { photoNo: 'asc' }],
        select: { photoNo: true, updatedAt: true },
      }),
    ]);
    if (!owner) return;

    const likerName = liker?.name?.trim() || 'Someone';
    const imageUrl = firstPhoto
      ? publicVariantUrl(this.cdnBase(), listingId, firstPhoto.photoNo, 'preview', firstPhoto.updatedAt)
      : undefined;

    void this.pushService
      .notifyListingFavourite(ownerId, {
        listingId,
        listingTitle,
        likerName,
        imageUrl,
      })
      .catch(() => undefined);

    // Email/WhatsApp only while boosted — same gate as before.
    if (!isBoosted) return;

    const channel = await this.notificationsService.notifyListingLiked(owner, listingTitle, likerName);
    // Deliberately not gated on "has this listing ever logged a 'liked' row before" — unlike
    // the one-shot kinds, this one is meant to accumulate: one row per person who likes it,
    // for as long as it stays boosted. See ListingNotificationLog's own comment on why it isn't
    // unique on (listingId, kind) any more.
    if (channel) {
      await this.prisma.listingNotificationLog.create({
        data: { listingId, kind: 'liked', channel },
      });
    }
  }

  /** 24h between interest push / Instant Alerts for the same (listing, user) — see
   * docs/plans/login-gated-listing-interest-owner-notify.md. */
  private static readonly INTEREST_RENOTIFY_MS = 24 * 60 * 60 * 1000;

  /**
   * Upsert identified interest. `mode: 'view'` may notify the owner (push always; email/WhatsApp
   * when Instant Alerts is active) — fired on authenticated detail open (99acres-style).
   * `mode: 'message'` only records the row and stamps `lastNotifiedAt` so a later view doesn't
   * double-ping within 24h — message Instant Alerts / push already covers the notify.
   */
  async recordInterest(
    listingId: string,
    userId: string,
    mode: 'view' | 'message' = 'view',
  ): Promise<RecordListingInterestResponseDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        instantAlertsUntil: true,
        publishState: true,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId === userId) {
      throw new BadRequestException("You can't register interest in your own listing");
    }
    if (listing.publishState !== 'live') {
      throw new BadRequestException('This listing is not available yet');
    }

    const now = new Date();
    const existing = await this.prisma.listingInterest.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });

    const withinWindow =
      existing?.lastNotifiedAt != null &&
      now.getTime() - existing.lastNotifiedAt.getTime() < ListingsService.INTEREST_RENOTIFY_MS;

    // Message path: never send the interest-specific notify (message path already does).
    // Still stamp lastNotifiedAt so a follow-up view within 24h doesn't email twice.
    const shouldNotifyInterest = mode === 'view' && !withinWindow;
    const stampNotified = shouldNotifyInterest || mode === 'message';

    await this.prisma.listingInterest.upsert({
      where: { listingId_userId: { listingId, userId } },
      create: {
        listingId,
        userId,
        lastNotifiedAt: stampNotified ? now : null,
      },
      update: {
        lastSeenAt: now,
        ...(stampNotified ? { lastNotifiedAt: now } : {}),
      },
    });

    if (shouldNotifyInterest) {
      void this.notifyOwnerOfInterest(listingId, listing.ownerId, userId, listing.title, listing.instantAlertsUntil).catch(
        (err: unknown) =>
          this.logger.error(`Failed to notify owner of interest on listing ${listingId}`, err),
      );
    }

    return { interested: true, notified: shouldNotifyInterest };
  }

  private async notifyOwnerOfInterest(
    listingId: string,
    ownerId: string,
    interestedUserId: string,
    listingTitle: string,
    instantAlertsUntil: Date | null,
  ): Promise<void> {
    const [owner, interested, firstPhoto] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { email: true, phone: true },
      }),
      this.prisma.user.findUnique({
        where: { id: interestedUserId },
        select: { name: true },
      }),
      this.prisma.listingPhoto.findFirst({
        where: { listingId },
        orderBy: [{ displayOrder: 'asc' }, { photoNo: 'asc' }],
        select: { photoNo: true, updatedAt: true },
      }),
    ]);
    if (!owner) return;

    const interestedName = interested?.name?.trim() || 'Someone';
    const imageUrl = firstPhoto
      ? publicVariantUrl(this.cdnBase(), listingId, firstPhoto.photoNo, 'preview', firstPhoto.updatedAt)
      : undefined;

    // Push always (best-effort) — Instant Alerts only adds email/WhatsApp.
    void this.pushService
      .notifyListingInterest(ownerId, {
        listingId,
        listingTitle,
        interestedName,
        imageUrl,
      })
      .catch(() => undefined);

    if ((instantAlertsUntil?.getTime() ?? 0) <= Date.now()) return;

    const channel = await this.notificationsService.notifyListingInterest(owner, {
      interestedName,
      listingTitle,
    });
    if (channel) {
      await this.prisma.listingNotificationLog.create({
        data: { listingId, kind: 'listing_interest', channel },
      });
    }
  }

  /** Owner-only list of identified interested buyers for one listing. */
  async listInterests(
    listingId: string,
    ownerId: string,
    offset = 0,
    limit = 50,
  ): Promise<ListingInterestPage> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId !== ownerId) throw new ForbiddenException('Not your listing');

    const [rows, total] = await Promise.all([
      this.prisma.listingInterest.findMany({
        where: { listingId },
        orderBy: { lastSeenAt: 'desc' },
        skip: offset,
        take: limit,
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.listingInterest.count({ where: { listingId } }),
    ]);

    const userIds = rows.map((r) => r.userId);
    const conversations =
      userIds.length === 0
        ? []
        : await this.prisma.conversation.findMany({
            where: {
              listingId,
              type: 'inquiry',
              inquirerId: { in: userIds },
            },
            select: { id: true, inquirerId: true },
          });
    const conversationByInquirer = new Map(conversations.map((c) => [c.inquirerId, c.id]));

    const items: ListingInterestDto[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      conversationId: conversationByInquirer.get(r.userId) ?? null,
    }));

    return { items, total };
  }

  /**
   * Owner starts or reopens an inquiry thread with an interested buyer so they can Message them
   * from My listings without waiting for the buyer to write first.
   */
  async openInterestConversation(
    listingId: string,
    ownerId: string,
    inquirerId: string,
  ): Promise<{ conversationId: string }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId !== ownerId) throw new ForbiddenException('Not your listing');

    const interest = await this.prisma.listingInterest.findUnique({
      where: { listingId_userId: { listingId, userId: inquirerId } },
    });
    if (!interest) throw new NotFoundException('No interest recorded for this buyer');

    const conversation = await this.prisma.conversation.upsert({
      where: {
        listingId_inquirerId_type: { listingId, inquirerId, type: 'inquiry' },
      },
      update: {},
      create: {
        listingId,
        inquirerId,
        posterId: ownerId,
        type: 'inquiry',
      },
    });

    return { conversationId: conversation.id };
  }

  async listFavourites(userId: string): Promise<ListingCardDto[]> {
    const favourites = await this.prisma.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
        },
      },
    });
    const favouritedIds = new Set(favourites.map((f) => f.listingId));
    const revealStates = await this.contactRevealService.getRevealStatesForListings(
      userId,
      favourites.map((f) => ({ id: f.listing.id, ownerPhone: f.listing.owner.phone, ownerEmail: f.listing.owner.email })),
    );
    return favourites.map((f) => this.toCardDto(f.listing, favouritedIds, userId, revealStates));
  }

  private async getFavouritedIds(
    userId: string | undefined,
    listingIds: string[],
  ): Promise<Set<string>> {
    if (!userId || listingIds.length === 0) return new Set();
    const rows = await this.prisma.favourite.findMany({
      where: { userId, listingId: { in: listingIds } },
      select: { listingId: true },
    });
    return new Set(rows.map((r) => r.listingId));
  }

  /**
   * Coerces number-typed attributes to actual JSON numbers.
   *
   * Every client sends them as strings — the posting wizard's inputs are text, and
   * `CATEGORY_FIELD_CONFIG`'s own `defaultValue` for bedrooms is the string `"0"`. Stored that
   * way, `attributes.bedrooms` was `"2"`, and the bedroom filter compares against the number 2:
   * so **every BHK filter and every `/{n}bhk` facet page returned nothing at all**, whatever was
   * ticked. One production row even held `"02"`, which no string comparison would have matched
   * either.
   *
   * Normalising on the way in rather than casting on the way out is what keeps one
   * representation in the column: the filter, the facet path builder
   * (`canonicalFacetPath`) and `cardSpecs` all read the same value, and a cast in the query would
   * have had to be repeated in each of them — and cannot be expressed in a Prisma JSON filter at
   * all.
   *
   * Runs after `assertValidAttributes`, which has already rejected anything non-numeric, so a
   * value that survives to here converts or is left exactly as it was.
   */
  private normalizeAttributes(
    category: ListingCategory,
    attributes: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...attributes };
    for (const field of CATEGORY_FIELD_CONFIG[category]) {
      // `area` is a number with an accompanying unit — the number itself normalizes exactly like
      // `number` does; the unit sibling key isn't touched here; validated/defaulted in
      // assertValidAttributes and normalizeAreaUnit below.
      if (field.type !== 'number' && field.type !== 'area') continue;
      const value = normalized[field.key];
      if (typeof value !== 'string' || value.trim() === '') continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) normalized[field.key] = parsed;
    }
    return normalized;
  }

  private assertValidAttributes(
    category: ListingCategory,
    transactionType: TransactionType,
    attributes: Record<string, unknown>,
  ): void {
    for (const field of CATEGORY_FIELD_CONFIG[category]) {
      const value = attributes[field.key];
      if (!fieldIsVisible(field, transactionType, attributes)) {
        if (value !== undefined)
          throw new BadRequestException(`${field.label} is not applicable`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'number' || field.type === 'area') {
          const issue = numberFieldIssue(field, value);
          if (issue) throw new BadRequestException(issue);
          if (field.type === 'area') this.assertValidAreaUnit(field, attributes[`${field.key}Unit`]);
        } else if (field.type === 'multi-select') {
          if (
            !Array.isArray(value) ||
            value.some((item) => typeof item !== 'string')
          ) {
            throw new BadRequestException(
              `${field.label} must contain valid selections`,
            );
          }
          const allowed = new Set(field.options?.map((option) => option.value));
          if (value.some((item) => !allowed.has(item)))
            throw new BadRequestException(
              `Invalid ${field.label.toLowerCase()}`,
            );
        } else if (field.type === 'select') {
          const allowed = field.options?.map((option) => option.value) ?? [];
          if (typeof value !== 'string' || !allowed.includes(value))
            throw new BadRequestException(
              `Invalid ${field.label.toLowerCase()}`,
            );
        }
      }

      if (!field.required) continue;
      const legacyValue =
        field.key === 'carpetAreaSqft' ? attributes.sqft : undefined;
      // An empty array is "missing" for a required multi-select field (e.g. sharingType) just
      // like an empty string is for a required select — without this, `[]` would pass as
      // satisfying "required" even though nothing was actually selected.
      const isMissing = (v: unknown): boolean =>
        v === undefined ||
        v === null ||
        v === '' ||
        (Array.isArray(v) && v.length === 0);
      if (isMissing(value) && isMissing(legacyValue)) {
        throw new BadRequestException(
          `${field.label} is required for this listing category`,
        );
      }
    }

    // Brokerage needs no call here: its type and amount fields are plain `required` fields gated
    // by `dependsOn`, which the loop above already enforces. Its limits against the price are
    // assertBrokerageFitsPrice, once the price is resolved.
    this.assertConditionalFee(
      category,
      transactionType,
      attributes,
      'maintenanceFeeApplicable',
      'Monthly maintenance fee',
    );
  }

  /** `price` is the resolved total (per-unit prices already multiplied out), monthly for rent/lease. */
  private assertBrokerageFitsPrice(
    transactionType: TransactionType,
    price: number,
    attributes: Record<string, unknown>,
  ): void {
    const issue = brokerageFeeIssue(transactionType, price, attributes);
    if (issue) throw new BadRequestException(issue);
  }

  /** Requires the amount behind a yes/no fee toggle (the field whose `dependsOn` is
   * `applicableKey` = yes), resolved from CATEGORY_FIELD_CONFIG so it stays in sync with that
   * file. Only the monthly maintenance fee uses it now — brokerage has a fee-type step in between
   * and relies on its fields' own `required` instead. */
  private assertConditionalFee(
    category: ListingCategory,
    transactionType: TransactionType,
    attributes: Record<string, unknown>,
    applicableKey: string,
    label: string,
  ): void {
    const applicable = attributes[applicableKey];
    if (
      applicable !== undefined &&
      applicable !== 'yes' &&
      applicable !== 'no'
    ) {
      throw new BadRequestException(
        `Invalid ${label.toLowerCase()} applicability`,
      );
    }

    const amountField = CATEGORY_FIELD_CONFIG[category].find(
      (field) =>
        field.dependsOn?.key === applicableKey &&
        field.dependsOn.value === 'yes' &&
        (!field.transactionTypes ||
          field.transactionTypes.includes(transactionType)),
    );
    // No amount field applies at all for this category/transactionType combination — nothing to
    // require or reject.
    if (!amountField) return;

    const amount = attributes[amountField.key];
    if (applicable === 'yes') {
      const numericAmount =
        typeof amount === 'number'
          ? amount
          : typeof amount === 'string' && amount.trim() !== ''
            ? Number(amount)
            : NaN;
      if (!Number.isInteger(numericAmount) || numericAmount < 0)
        throw new BadRequestException(`${amountField.label} is required`);
    } else if (amount !== undefined && amount !== null && amount !== '') {
      throw new BadRequestException(
        `${amountField.label} requires applicability to be Yes`,
      );
    }
  }

  private assertValidPriceQualifier(
    category: ListingCategory,
    transactionType: TransactionType,
    priceQualifier: string | undefined,
  ): void {
    const validValues = getPriceQualifierOptions(category, transactionType).map(
      (o) => o.value,
    );
    if (!validValues.includes(priceQualifier ?? '')) {
      throw new BadRequestException(
        'Invalid price qualifier for this category/transaction type',
      );
    }
  }

  /** price: 0 ("Contact for price") is only valid for PRICE_ON_REQUEST_CATEGORIES — see that
   * constant's doc comment. CreateListingDto/UpdateListingDto only enforce price >= 0 at the
   * shape level; this is the actual business rule. */
  private assertValidPrice(category: ListingCategory, price: number): void {
    if (price === 0 && !PRICE_ON_REQUEST_CATEGORIES.has(category)) {
      throw new BadRequestException(
        `A ${category} listing needs a real price — "Contact for price" isn't available for this category`,
      );
    }
  }

  /** `field.units` defaults to `["sqft"]` when absent (every non-Plot/Commercial area field) —
   * same "no unit stored means sqft" rule the whole feature relies on for zero-backfill backward
   * compatibility. Throws if a submitted unit isn't one this field actually offers. */
  private assertValidAreaUnit(field: FieldDef, unit: unknown): void {
    if (unit === undefined || unit === null || unit === '') return;
    const allowed = field.units ?? ['sqft'];
    if (typeof unit !== 'string' || !allowed.includes(unit as AreaUnit)) {
      throw new BadRequestException(`Invalid unit for ${field.label}`);
    }
  }

  private areaFieldFor(category: ListingCategory): FieldDef | undefined {
    return CATEGORY_FIELD_CONFIG[category].find((f) => f.type === 'area');
  }

  /** `price`/`priceUnit` as submitted by the client (`CreateListingInput`/`UpdateListingInput`)
   * always represent what the seller actually typed — the whole-rupee total when `priceUnit` is
   * absent, or a per-unit figure (e.g. 5000 meaning "₹5,000 per cent") when it's set. This
   * resolves that down to the one number ever stored in `Listing.price` — see `priceUnit`'s own
   * schema doc comment for why the total, never the per-unit figure, is what's stored and what
   * every existing sort/filter/bound continues to compare against.
   *
   * Only ever called for `sell`/`lease` (checked below) on a category with an `area` field — the
   * area value comes from the *same* attributes payload this request already carries, not a
   * re-read of the listing, so create and update behave identically. */
  private resolveListingPrice(
    category: ListingCategory,
    transactionType: TransactionType,
    price: number,
    priceUnit: string | undefined,
    attributes: Record<string, unknown>,
  ): { price: number; priceUnit: AreaUnit | null; area?: number } {
    if (!priceUnit) return { price, priceUnit: null };

    if (transactionType !== 'sell' && transactionType !== 'lease') {
      throw new BadRequestException('Price per unit is only available for Sell or Lease listings');
    }
    const areaField = this.areaFieldFor(category);
    if (!areaField) {
      throw new BadRequestException(`${category} listings don't have an area to price per unit of`);
    }
    this.assertValidAreaUnit(areaField, priceUnit);

    const areaRaw = attributes[areaField.key];
    const areaValue = typeof areaRaw === 'number' ? areaRaw : Number(areaRaw);
    if (!Number.isFinite(areaValue) || areaValue <= 0) {
      throw new BadRequestException(`${areaField.label} is required to price per unit of area`);
    }
    // Price-per-unit is always expressed in the area's own unit, never a separately-chosen one —
    // see FieldDef.units's own doc comment ("no separate unit choice for price"). A client that
    // somehow disagrees (a stale form, a direct API call) is a bug, not a legitimate combination.
    const resolvedAreaUnit = (attributes[`${areaField.key}Unit`] as AreaUnit | undefined) ?? 'sqft';
    if (priceUnit !== resolvedAreaUnit) {
      throw new BadRequestException("Price-per-unit must match the listing's own area unit");
    }

    return { price: Math.round(price * areaValue), priceUnit, area: areaValue };
  }

  /** The plausibility range, on the resolved total. Checking what the seller typed instead
   * rejected ordinary per-unit rates (₹12,500/sq ft is under the ₹1 lakh minimum) and let an
   * inflated one through to overflow `Listing.price`'s Int column. */
  private assertPriceInRange(
    category: ListingCategory,
    transactionType: TransactionType,
    typedPrice: number,
    resolved: { price: number; priceUnit: AreaUnit | null; area?: number },
  ): void {
    const issue = listingPriceIssue(
      category,
      transactionType,
      resolved.price,
      resolved.priceUnit && resolved.area
        ? { price: typedPrice, area: resolved.area, unit: resolved.priceUnit }
        : undefined,
    );
    if (issue) throw new BadRequestException(issue);
  }

  /** The reverse of `resolveListingPrice` — re-derives what the seller actually typed (the
   * per-unit figure) from the stored whole-rupee total, for display. Division introduces the same
   * harmless rounding drift `promoPriceFor` already accepts elsewhere in this codebase; a listing
   * re-saved unchanged round-trips back to the same total either way. */
  private perUnitPrice(listing: { category: ListingCategory; price: number; priceUnit: string | null; attributes: unknown }): number | null {
    if (!listing.priceUnit) return null;
    const areaField = this.areaFieldFor(listing.category);
    const attrs = (listing.attributes as Record<string, unknown> | null) ?? {};
    const areaRaw = areaField ? attrs[areaField.key] : undefined;
    const areaValue = typeof areaRaw === 'number' ? areaRaw : Number(areaRaw);
    if (!areaField || !Number.isFinite(areaValue) || areaValue <= 0) return null;
    return Math.round(listing.price / areaValue);
  }

  /** "₹1,50,000" or, when `priceUnit` is set, "₹5,000/cent" — every display call site (card,
   * detail, admin queue row) renders this one formatted string, same convention `priceQualifier`
   * already uses for a rental-cadence suffix (see that field's own history) rather than exposing
   * the raw per-unit number and unit separately to callers that only ever print it. */
  private formatListingPrice(listing: { category: ListingCategory; price: number; priceUnit: string | null; attributes: unknown }): string {
    if (listing.price === 0) return 'Contact for price';
    const perUnit = this.perUnitPrice(listing);
    if (perUnit === null || !listing.priceUnit) {
      return `₹${priceFormatter.format(listing.price)}`;
    }
    return `₹${priceFormatter.format(perUnit)}/${areaUnitShortLabel(listing.priceUnit as AreaUnit, perUnit)}`;
  }

  /** For a per-unit price, the stored total it came from and the area it was multiplied by — what
   * cards lead with instead of the rate alone. Null for a whole price or one we can't split. */
  private listingTotalPrice(listing: {
    category: ListingCategory;
    price: number;
    priceUnit: string | null;
    attributes: unknown;
  }): ListingTotalPriceDto | null {
    if (listing.price === 0 || !listing.priceUnit || this.perUnitPrice(listing) === null) return null;
    const areaField = this.areaFieldFor(listing.category);
    const attrs = (listing.attributes as Record<string, unknown> | null) ?? {};
    const areaValue = Number(areaField ? attrs[areaField.key] : undefined);
    return perUnitTotalPrice(listing.price, areaValue, listing.priceUnit as AreaUnit);
  }

  /** Buyer-facing twin of `formatListingPrice` — "₹35 Lakh" / "₹5 Thousand/cent". */
  private formatListingPriceInWords(listing: { category: ListingCategory; price: number; priceUnit: string | null; attributes: unknown }): string {
    if (listing.price === 0) return 'Contact for price';
    const perUnit = this.perUnitPrice(listing);
    if (perUnit === null || !listing.priceUnit) return formatInrInWords(listing.price);
    return `${formatInrInWords(perUnit)}/${areaUnitShortLabel(listing.priceUnit as AreaUnit, 1)}`;
  }

  /** Writes one ListingEditLog row — see that model's own doc comment for the shape. Awaited
   * (not fire-and-forget) since this is meant to be a reliable audit trail, not a best-effort
   * notification like ListingNotificationLog — but a logging failure still must never fail or
   * roll back the real mutation it's describing, hence the catch-and-log-only rather than letting
   * it throw. AdminService writes its own rows directly (its moderation actions aren't
   * ListingsService methods) rather than through this — same shape, no cross-service call. */
  private async logEdit(
    listingId: string,
    actorType: 'owner' | 'admin' | 'system',
    actorId: string | null,
    action: string,
    changes: Record<string, { before: unknown; after: unknown }> | null,
  ): Promise<void> {
    try {
      await this.prisma.listingEditLog.create({
        data: {
          listingId,
          actorType,
          actorId,
          action,
          ...(changes && Object.keys(changes).length > 0
            ? { changes: changes as Prisma.InputJsonValue }
            : {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write ListingEditLog for ${listingId} (${action}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }


  /** First photo's preview URL, for the picture on a push notification — undefined when the
   * listing has no photo. Same lookup and variant the favourite/interest pushes use. */
  async getPushImageUrl(listingId: string): Promise<string | undefined> {
    const firstPhoto = await this.prisma.listingPhoto.findFirst({
      where: { listingId },
      orderBy: [{ displayOrder: 'asc' }, { photoNo: 'asc' }],
      select: { photoNo: true, updatedAt: true },
    });
    return firstPhoto
      ? publicVariantUrl(this.cdnBase(), listingId, firstPhoto.photoNo, 'preview', firstPhoto.updatedAt)
      : undefined;
  }

  private cdnBase(): string {
    return this.config.get<string>('CDN_BASE_URL') ?? '';
  }

  private toDetailDto(
    listing: Listing & {
      city: City;
      area: Area;
      listingPhotos: ListingPhoto[];
      listingVideos: ListingVideo[];
      owner: {
        agentProUntil: Date | null;
        phone: string | null;
        email: string | null;
        sellerType?: SellerType | null;
        agencyName?: string | null;
        reraVerifiedAt?: Date | null;
      };
      listingRenewals: ListingRenewal[];
      claimContact?: { phone: string | null; email: string | null } | null;
    },
    favouritedIds?: Set<string>,
    // Only true for the owner's own view or an admin's — gates both which video statuses are
    // visible (a public/other-user viewer must never see a pending/processing/failed video, since
    // its <video> src wouldn't resolve to a real object yet) and whether videoEntitlement is
    // populated at all (the client must never recompute tier itself — see resolveVideoEntitlement's
    // doc comment in packages/types/src/videoLimits.ts).
    isOwnerOrAdmin = false,
    /** Strictly the poster — see the call site in `findOne`. */
    isOwner = false,
    /** Only `findOne` computes a real one (an async ContactRevealService call, done before this
     * synchronous method runs — same pattern as favouritedIds above). Every other call site
     * returns a DTO to the listing's own owner right after a mutation (create/update/etc.), where
     * contact-reveal state is meaningless — those default to "not revealed", which the frontend
     * never actually renders since isOwner already hides the reveal button entirely. */
    revealState: ContactRevealState = { contactRevealed: false, ownerPhone: null, ownerEmail: null },
  ): ListingDetailDto {
    const videos = (
      isOwnerOrAdmin
        ? listing.listingVideos
        : listing.listingVideos.filter((v) => v.status === 'done')
    ).map((v): ListingVideoDto => ({
      id: v.id,
      videoNo: v.videoNo,
      url: videoUrl(this.cdnBase(), listing.id, v.storageId),
      posterUrl: videoPosterUrl(this.cdnBase(), listing.id, v.storageId),
      durationSec: v.durationSec,
      status: v.status,
    }));

    return {
      ...this.toCardDto(listing, favouritedIds),
      priceUnit: listing.priceUnit as AreaUnit | null,
      description: listing.description,
      status: listing.status,
      publishState: listing.publishState,
      publishedAt: listing.publishedAt?.toISOString() ?? null,
      moderationState: listing.moderationState,
      adminReviewed: listing.adminReviewed,
      moderatedAt: listing.moderatedAt?.toISOString() ?? null,
      attributes: listing.attributes as Record<string, unknown>,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
      // publicVariantUrl, not variantUrl — the cache-busting ?t=<updatedAt> is what makes a
      // rotated photo actually show up correctly here (not just in the admin panel) instead of
      // waiting out Cloudflare's edge cache AND Next.js's own separate image-optimizer cache,
      // neither of which revisits a URL that hasn't changed. See
      // docs/plans/listing-photo-orientation.md.
      photosFull: listing.listingPhotos.map((p) =>
        publicVariantUrl(this.cdnBase(), listing.id, p.photoNo, 'full', p.updatedAt),
      ),
      // Same order as photosFull — exists so the admin rotate control has something to send
      // back other than an array index, which would silently break if a photo is ever deleted
      // out of the middle of the sequence. Harmless for every other consumer to receive.
      photoNos: listing.listingPhotos.map((p) => p.photoNo),
      photoRotations: listing.listingPhotos.map((p) => p.rotation),
      // Cache-busting value for the admin UI — deliberately NOT `rotation` itself, which cycles
      // (0/90/180/270/0/…) and would collide with an already-cached ?r=0 request from before the
      // photo was ever rotated. See ListingPhoto.updatedAt's own doc comment for why that matters.
      photoUpdatedAts: listing.listingPhotos.map((p) => p.updatedAt.getTime()),
      videos,
      videoEntitlement: isOwnerOrAdmin
        ? resolveVideoEntitlement(listing.owner, listing)
        : undefined,
      renewCount: listing.listingRenewals.length,
      isOwner,
      // The Bulk Import account "owns" admin-assisted and scraped listings — not a referrer.
      ...(isOwner && !isBulkImportOwner(listing.owner) ? { viewerReferralCode: listing.ownerId } : {}),
      renewalHistory: isOwnerOrAdmin
        ? listing.listingRenewals.map((r) => ({
            from: r.previousExpiresAt.toISOString(),
            to: r.newExpiresAt.toISOString(),
            renewedAt: r.renewedAt.toISOString(),
          }))
        : undefined,
      cityId: listing.cityId,
      areaId: listing.areaId,
      exactLat: isOwnerOrAdmin ? listing.lat ?? undefined : undefined,
      exactLng: isOwnerOrAdmin ? listing.lng ?? undefined : undefined,
      ...this.jitteredLocation(listing),
      ...revealState,
    };
  }

  /** The public-facing pin is always an approximation of the real one — randomly offset within
   * ~150m, or the area centroid if no pin was ever dropped at posting time. Computed here (not
   * on the client) so the seller's exact coordinates never round-trip to the browser at all, for
   * anyone. See docs/plans/google-maps-location-picker.md. */
  private jitteredLocation(listing: Listing & { area: Area }): {
    lat?: number;
    lng?: number;
  } {
    if (listing.lat == null || listing.lng == null) {
      return {
        lat: listing.area.lat ?? undefined,
        lng: listing.area.lng ?? undefined,
      };
    }

    const JITTER_METERS = 150;
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng =
      metersPerDegreeLat * Math.cos((listing.lat * Math.PI) / 180);
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * JITTER_METERS;

    return {
      lat: listing.lat + (Math.sin(angle) * distance) / metersPerDegreeLat,
      lng: listing.lng + (Math.cos(angle) * distance) / metersPerDegreeLng,
    };
  }

  /** The listing's own `fromBroker` answer wins over the account's, for an agent posting their own
   * flat; the agency name only shows when both say "agent". */
  private postedBy(listing: {
    attributes: unknown;
    owner: { sellerType?: SellerType | null; agencyName?: string | null; reraVerifiedAt?: Date | null };
  }): Pick<ListingCardDto, 'postedBy' | 'postedByAgency' | 'postedByReraVerified'> {
    const postedBy = fromBrokerAnswer(listing.attributes) ?? listing.owner.sellerType ?? null;
    const bothAgent = postedBy === 'agent' && listing.owner.sellerType === 'agent';
    return {
      postedBy,
      postedByAgency: bothAgent ? listing.owner.agencyName ?? null : null,
      postedByReraVerified: bothAgent && !!listing.owner.reraVerifiedAt,
    };
  }

  private toCardDto(
    listing: Listing & {
      city: City;
      area: Area;
      listingPhotos: ListingPhoto[];
      listingVideos: ListingVideo[];
      owner: {
        phone: string | null;
        email: string | null;
        sellerType?: SellerType | null;
        agencyName?: string | null;
        reraVerifiedAt?: Date | null;
      };
      claimContact?: { phone: string | null; email: string | null } | null;
    },
    favouritedIds?: Set<string>,
    /** Compared against the row's ownerId — see the DTO field. */
    viewerId?: string,
    /** From ContactRevealService.getRevealStatesForListings — one batched lookup per page rather
     * than a query per card. Defaults to "not revealed" when absent (matches favouritedIds'
     * default-to-empty pattern), which is also what toDetailDto relies on: its own internal
     * `toCardDto(listing, favouritedIds)` call intentionally omits this, since toDetailDto spreads
     * its own single-listing revealState over the result afterward anyway. */
    revealStates?: Map<string, ContactRevealState>,
  ): ListingCardDto {
    const placeholder = categoryImagePlaceholder[listing.category];
    const hasPhoto = listing.listingPhotos.length > 0;

    return {
      id: listing.id,
      category: listing.category,
      transactionType: listing.transactionType,
      slug: listing.slug,
      tag: listing.tag,
      price: this.formatListingPrice(listing),
      priceInWords: this.formatListingPriceInWords(listing),
      totalPrice: this.listingTotalPrice(listing),
      // A qualifier ("/month") next to "Contact for price" reads oddly, so it's suppressed here
      // rather than at posting time — the stored value (if any) survives for if/when the owner
      // sets a real price.
      priceQualifier: listing.price === 0 ? '' : listing.priceQualifier,
      priceOnRequest: listing.price === 0,
      title: listing.title,
      area: listing.area.name,
      cityName: listing.city.name,
      // Derived from the attributes the seller already filled in, not from what they typed into
      // a second free-text box — which is how production ended up with "3bhk", "3 BHK" and
      // "3 Beds" as three spellings of one number, and a bare "1500" that did not say what it
      // measured. The stored column is the fallback for listings posted before this.
      specs: cardSpecs(listing),
      imgLabel: hasPhoto ? '' : placeholder.imgLabel,
      imgColors: [placeholder.imgA, placeholder.imgB],
      // publicVariantUrl — see the matching comment on photosFull in toDetailDto.
      photos: listing.listingPhotos.map((p) =>
        publicVariantUrl(this.cdnBase(), listing.id, p.photoNo, 'preview', p.updatedAt),
      ),
      viewCount: listing.viewCount,
      likeCount: listing.likeCount,
      isFavourited: favouritedIds?.has(listing.id) ?? false,
      isBoosted: isListingBoosted(listing),
      hasInstantAlerts: (listing.instantAlertsUntil?.getTime() ?? 0) > Date.now(),
      isOwner: viewerId !== undefined && viewerId === listing.ownerId,
      ...(viewerId !== undefined && viewerId === listing.ownerId && !isBulkImportOwner(listing.owner)
        ? { viewerReferralCode: viewerId }
        : {}),
      // Browse-card badge only — not gated on isOwnerOrAdmin like toDetailDto's `videos` array,
      // since "does this listing have a playable video at all" is fine as public info once done.
      hasVideo: listing.listingVideos.some((v) => v.status === 'done'),
      ownerUnverified: isBulkImportOwner(listing.owner),
      contactUnavailable:
        isBulkImportOwner(listing.owner) && !listing.claimContact?.phone && !listing.claimContact?.email,
      ...this.postedBy(listing),
      ...(revealStates?.get(listing.id) ?? { contactRevealed: false, ownerPhone: null, ownerEmail: null }),
    };
  }
}
