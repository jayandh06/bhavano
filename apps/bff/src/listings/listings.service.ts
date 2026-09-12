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
  AdminListingsPage,
  ClaimSource,
  CreateListingInput,
  CreatedVideoInput,
  HomeCategoryFilter,
  ListingCardDto,
  ListingCategory,
  ListingDetailDto,
  ListingEditLogEntryDto,
  ListingEditLogPage,
  ListingEngagementPage,
  ListingEngagementRowDto,
  ListingMetaDto,
  ListingSitemapEntry,
  ListingStatus,
  ListingVideoDto,
  ListingsPage,
  PopularSearchDto,
  PropertyTypeFilter,
  TransactionType,
  UserRole,
} from '@bhavano/types';
import { categoryImagePlaceholder } from '@bhavano/types/tokens';
import { slugify } from '@bhavano/types/slugify';
import { deriveTag } from '@bhavano/types/listingTag';
import { CATEGORY_FIELD_CONFIG } from '@bhavano/types/categoryFields';
import { deriveCardSpecs } from '@bhavano/types/cardSpecs';
import { getPriceQualifierOptions, PRICE_ON_REQUEST_CATEGORIES } from '@bhavano/types/priceQualifiers';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import { resolveVideoEntitlement } from '@bhavano/types/videoLimits';
import { MAX_PHOTOS } from '@bhavano/types/photoLimits';
import { PrismaService } from '../prisma/prisma.service';
import { toE164India } from '../outreach/phone';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
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
import { UpdateListingDto } from './dto/update-listing.dto';
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
import { ContactRevealService, type ContactRevealState } from '../contact-reveal/contact-reveal.service';

/** Fixed for now — a future paid-plan tier would compute a different duration here
 * instead of this flat constant, without needing any schema change. */
const DEFAULT_LISTING_DURATION_DAYS = 30;
// Same literal as OutreachService's own BULK_IMPORT_OWNER_PHONE and seedBulkImportOwner.ts —
// the system account bulk_upload_listings.py and OutreachService.createListingFromContact post
// under instead of a real user's. Checked here so create()'s owner-facing side effects (the
// "your ad was posted" WhatsApp/email/SMS, the Google Ads "post ad success" conversion upload)
// don't fire for a phone number nobody's actually monitoring, or attribute a fake acquisition
// event to a system account. savedSearchesService.notifyMatchingBuyers below is NOT skipped —
// real buyers with a matching saved search should hear about a real new listing regardless of
// which account technically posted it.
const BULK_IMPORT_OWNER_PHONE = '9000000002';

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
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { id: 'asc' }],
  popular: [{ viewCount: 'desc' }, { id: 'asc' }],
};

/** Same tie-breaker convention as ORDER_BY above, for the admin listings screen's own
 * (smaller) set of sort options. */
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
  owner: { select: { agentProUntil: true, phone: true, email: true } },
  listingRenewals: { orderBy: { renewedAt: 'desc' as const } },
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
    if (sharingType)
      attributeFilters.push({
        attributes: { path: ['sharingType'], equals: sharingType },
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
      moderationState: 'approved',
      expiresAt: { gt: new Date() },
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
      ...ORDER_BY[sort ?? 'newest'],
    ];

    // Offset mode (numbered `?page=N` pagination — see ListListingsDto.offset) fetches the exact
    // window directly, since the caller already knows the total and doesn't need a `hasMore`
    // look-ahead row the way cursor-based append does. Two explicit branches (rather than
    // spreading a ternary into one `findMany` call) because Prisma's generated overloads can't
    // resolve a call built from a union of arg shapes.
    const [rows, total] = await Promise.all([
      offset !== undefined
        ? this.prisma.listing.findMany({
            where,
            include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
            orderBy,
            skip: offset,
            take: limit,
          })
        : this.prisma.listing.findMany({
            where,
            include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
            orderBy,
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          }),
      this.prisma.listing.count({ where }),
    ]);

    if (offset !== undefined) {
      const favouritedIds = await this.getFavouritedIds(
        currentUserId,
        rows.map((r) => r.id),
      );
      const revealStates = await this.contactRevealService.getRevealStatesForListings(
        currentUserId,
        rows.map((r) => ({ id: r.id, ownerPhone: r.owner.phone, ownerEmail: r.owner.email })),
      );
      return {
        items: rows.map((row) => this.toCardDto(row, favouritedIds, currentUserId, revealStates)),
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

  /** Admin moderation queue — every listing regardless of status/moderationState/expiry
   * (unlike the public `list()`, which only ever shows approved, active, unexpired ones). */
  async listForAdmin(query: ListAdminListingsDto): Promise<AdminListingsPage> {
    const {
      moderationState,
      adminReviewed,
      category,
      transactionType,
      status,
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
      ...(moderationState ? { moderationState } : {}),
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
        include: {
          city: true,
          area: true,
          ...LISTING_MEDIA_INCLUDE,
          // Newest "posted" row only — mirrors AdminService.listUsers' notificationLogs include
          // for the "welcomed" column. Admin-only: no other listForAdmin caller pays for this.
          notificationLogs: { where: { kind: 'posted' }, orderBy: { sentAt: 'desc' }, take: 1 },
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

    // Admin queue — every viewer here is an admin, so full video status/entitlement visibility.
    return {
      items: rows.map((row) => ({
        ...this.toDetailDto(row, undefined, true),
        postedNotificationSent: row.notificationLogs.length > 0,
        postedNotificationChannel: row.notificationLogs[0]?.channel ?? null,
        postedNotificationSentAt: row.notificationLogs[0]?.sentAt.toISOString() ?? null,
        postedNotificationDeliveryStatus: row.notificationLogs[0]?.deliveryStatus ?? null,
        messageCount: row._count.conversations,
        source: row.source,
        claimSource: row.claimSource,
      })),
      total,
    };
  }

  /** A listing's "History" tab — every ListingEditLog row, newest first. `actorName` is resolved
   * here (not stored denormalized on the log row) so a later name change is reflected
   * retroactively rather than freezing whatever the actor was called at the time — same tradeoff
   * ListingBoostDto.ownerName already makes. Null for 'system' rows (no actorId at all). */
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

    const favouritedIds = await this.getFavouritedIds(currentUser?.id, [id]);
    const revealState = await this.contactRevealService.getRevealState(
      currentUser?.id ?? null,
      id,
      listing.owner.phone,
      listing.owner.email,
    );
    // Ownership is passed separately from isOwnerOrAdmin: an admin looking at someone else's
    // listing is not its owner and may well need the contact actions, so the two cannot share a
    // flag even though they are computed a line apart.
    return this.toDetailDto(
      listing,
      favouritedIds,
      isOwnerOrAdmin,
      currentUser?.id === listing.ownerId,
      revealState,
    );
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
    if (!listing || listing.moderationState === 'flagged') {
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
      price: listing.price === 0 ? 'Contact for price' : `₹${priceFormatter.format(listing.price)}`,
      priceQualifier: listing.price === 0 ? '' : listing.priceQualifier,
      priceOnRequest: listing.price === 0,
      description: listing.description,
      specs: cardSpecs(listing),
      ogImage: firstPhoto
        ? publicVariantUrl(this.cdnBase(), listing.id, firstPhoto.photoNo, 'full', firstPhoto.updatedAt)
        : null,
    };
  }

  async create(
    input: CreateListingInput,
    ownerId: string,
  ): Promise<ListingDetailDto> {
    if (!input.photos.length)
      throw new BadRequestException('At least one photo is required');
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
      },
    });
    if (owner?.deletedAt) {
      throw new UnauthorizedException('This account was deleted');
    }
    await this.listingSlotsService.assertCanPublish(ownerId);
    this.assertValidAttributes(
      input.category,
      input.transactionType,
      input.attributes ?? {},
    );
    this.assertValidPriceQualifier(
      input.category,
      input.transactionType,
      input.priceQualifier,
    );
    this.assertValidPrice(input.category, input.price);

    const moderation = await this.moderationService.moderate(input);
    if (!moderation.ok) throw new BadRequestException(moderation.reason);

    const areaId =
      input.areaId ??
      (await this.locationsService.ensureArea(input.cityId, input.areaName)).id;
    const expiresAt = new Date(
      Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    const created = await this.prisma.listing.create({
      data: {
        id: input.id,
        category: input.category,
        transactionType: input.transactionType,
        price: input.price,
        priceQualifier: input.priceQualifier ?? '',
        title: input.title,
        slug: slugify(input.title),
        areaId,
        cityId: input.cityId,
        specs: input.specs ?? [],
        // Empty string normalised to null: "left blank" and "cleared" are the same thing here,
        // and a null keeps the "has a description" check a single test everywhere downstream.
        description: input.description?.trim() || null,
        attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
        tag: deriveTag(input),
        ownerId,
        expiresAt,
        lat: input.lat,
        lng: input.lng,
        claimContactId: input.claimContactId ?? null,
        // A post-creation addPhoto atomically increments this — see the field's own doc comment
        // in schema.prisma for why it must start at least as high as any photoNo already in use.
        photoNoCounter: Math.max(0, ...input.photos.map((p) => p.photoNo)),
      },
    });

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

    // Fire-and-forget — Bhavano Plus's early-access alerts should never add latency to (or
    // break) the poster's own submission.
    this.savedSearchesService
      .notifyMatchingBuyers(created)
      .catch(() => undefined);

    // Reports the "Post ad success" conversion to Google Ads directly from the backend, using
    // the owner's first-touch gclid (captured at their signup — not a listing-time gclid; see
    // docs/plans/server-side-google-ads-conversion-upload.md for why, and the caveat that
    // implies for an owner posting long after signing up) when there is one, but proceeding on
    // email/phone alone otherwise — Google's own guidance for this account was to send every
    // event with user-provided data rather than only ones that also have a click id (see
    // GoogleAdsConversionProvider.uploadClickConversion's doc comment). Never blocks or fails the
    // listing creation itself — uploadClickConversion already never throws, .catch() is
    // belt-and-braces.
    const isBulkImportOwner = owner?.phone === BULK_IMPORT_OWNER_PHONE;

    if (!isBulkImportOwner && (owner?.acquisitionGclid || owner?.email || owner?.phone)) {
      void this.googleAdsConversionProvider
        .uploadClickConversion({
          gclid: owner.acquisitionGclid ?? undefined,
          conversionActionId: POST_AD_SUCCESS_CONVERSION_ACTION_ID,
          transactionId: `listing-${created.id}`,
          eventTimestamp: created.createdAt,
          email: owner.email,
          phone: owner.phone,
        })
        .catch(() => undefined);
    }

    // Same fire-and-forget rule for the poster's own acknowledgement — see
    // docs/plans/post-ad-acknowledgement.md. `owner` is never null here: `assertCanPublish`
    // above and the `deletedAt` check both already require the row to exist.
    if (!isBulkImportOwner) {
      this.notificationsService
        .notifyListingPosted(owner!, {
          id: listing.id,
          slug: listing.slug,
          category: listing.category,
          transactionType: listing.transactionType,
          cityName: listing.city.name,
          area: listing.area.name,
          title: listing.title,
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
    }

    await this.logEdit(listing.id, isBulkImportOwner ? 'system' : 'owner', ownerId, 'created', null);

    return this.toDetailDto(listing, undefined, true);
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
    if (await this.moderationService.isDuplicatePhotoHash(hash)) {
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

    return listings.map((listing) =>
      this.toDetailDto(listing, undefined, true),
    );
  }

  async getMine(userId: string, id: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    if (listing.ownerId !== userId)
      throw new ForbiddenException("You don't own this listing");

    return this.toDetailDto(listing, undefined, true);
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

  /** Admin override of a listing's own content — price, title, description, specs, attributes —
   * on top of the owner-only `update()` above. Same validation and the same ListingEditLog diff,
   * just without the ownership check and attributed to the admin instead of the owner. For
   * support cases where the owner can't be reached to fix something themselves (a typo in the
   * title, a price that's clearly wrong), mirroring why setStatusAsAdmin exists for status
   * specifically. */
  async updateAsAdmin(
    id: string,
    dto: UpdateListingDto,
    adminId: string,
  ): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);

    return this.applyUpdate(id, existing, dto, 'admin', adminId);
  }

  private async applyUpdate(
    id: string,
    existing: Listing,
    dto: UpdateListingDto,
    actorType: 'owner' | 'admin',
    actorId: string,
  ): Promise<ListingDetailDto> {
    if (dto.attributes !== undefined)
      this.assertValidAttributes(
        existing.category,
        existing.transactionType,
        dto.attributes,
      );
    if (dto.priceQualifier !== undefined) {
      this.assertValidPriceQualifier(
        existing.category,
        existing.transactionType,
        dto.priceQualifier,
      );
    }
    if (dto.price !== undefined) {
      this.assertValidPrice(existing.category, dto.price);
    }

    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.priceQualifier !== undefined
          ? { priceQualifier: dto.priceQualifier }
          : {}),
        ...(dto.title !== undefined
          ? { title: dto.title, slug: slugify(dto.title) }
          : {}),
        ...(dto.specs !== undefined ? { specs: dto.specs } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.attributes !== undefined
          ? { attributes: dto.attributes as Prisma.InputJsonValue }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
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
      },
      {
        price: dto.price,
        priceQualifier: dto.priceQualifier,
        title: dto.title,
        specs: dto.specs,
        description: dto.description,
        attributes: dto.attributes,
        status: dto.status,
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

    return this.toDetailDto(listing, undefined, true);
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
    if (!existing.claimContactId || !existing.claimContact) {
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
    if (!userPhoneE164 || userPhoneE164 !== existing.claimContact.phoneE164) {
      throw new ForbiddenException(
        "This phone number doesn't match the one on file for this business listing.",
      );
    }

    const claimedAt = new Date();
    const [, listing] = await this.prisma.$transaction([
      this.prisma.outreachContact.update({
        where: { id: existing.claimContactId },
        data: { userId },
      }),
      this.prisma.listing.update({
        where: { id: listingId },
        data: { ownerId: userId, claimedAt, claimSource: source },
        include: { city: true, area: true, ...LISTING_MEDIA_INCLUDE },
      }),
    ]);

    return this.toDetailDto(listing, undefined, true);
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
        moderationState: 'approved',
        expiresAt: { gt: new Date() },
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

  /** Minimal fields for every active, non-expired listing — feeds the web app's sitemap.xml. */
  async findAllForSitemap(): Promise<ListingSitemapEntry[]> {
    const listings = await this.prisma.listing.findMany({
      where: {
        status: 'active',
        moderationState: 'approved',
        expiresAt: { gt: new Date() },
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

  /** Records a unique-viewer hit — a no-op if this viewerKey already viewed this listing. */
  async recordView(
    listingId: string,
    viewerKey: string,
  ): Promise<{ viewCount: number }> {
    try {
      await this.prisma.listingView.create({ data: { listingId, viewerKey } });
      const listing = await this.prisma.listing.update({
        where: { id: listingId },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
      return { viewCount: listing.viewCount };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const listing = await this.prisma.listing.findUniqueOrThrow({
          where: { id: listingId },
          select: { viewCount: true },
        });
        return { viewCount: listing.viewCount };
      }
      throw error;
    }
  }

  async toggleFavourite(
    listingId: string,
    userId: string,
  ): Promise<{ favourited: boolean; likeCount: number }> {
    const existing = await this.prisma.favourite.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });

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

    // Fire-and-forget — a slow/failed notification should never add latency to (or break)
    // the favouriter's own click. Boost-only (see NotificationsService.notifyListingLiked):
    // an unboosted listing can rack up many low-intent likes, a boosted one is a smaller,
    // more engaged set where this is a meaningful signal instead of notification noise.
    const isBoosted = (listing.boostedUntil?.getTime() ?? 0) > Date.now();
    if (isBoosted && listing.ownerId !== userId) {
      this.notifyOwnerOfLike(
        listingId,
        listing.ownerId,
        userId,
        listing.title,
      ).catch(() => undefined);
    }

    return { favourited: true, likeCount: listing.likeCount };
  }

  private async notifyOwnerOfLike(
    listingId: string,
    ownerId: string,
    likerId: string,
    listingTitle: string,
  ): Promise<void> {
    const [owner, liker] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { email: true, phone: true },
      }),
      this.prisma.user.findUnique({
        where: { id: likerId },
        select: { name: true },
      }),
    ]);
    if (!owner) return;
    const channel = await this.notificationsService.notifyListingLiked(
      owner,
      listingTitle,
      liker?.name ?? 'Someone',
    );
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

  private assertValidAttributes(
    category: ListingCategory,
    transactionType: TransactionType,
    attributes: Record<string, unknown>,
  ): void {
    for (const field of CATEGORY_FIELD_CONFIG[category]) {
      const value = attributes[field.key];
      const appliesToTransaction =
        !field.transactionTypes ||
        field.transactionTypes.includes(transactionType);
      const meetsDependency =
        !field.dependsOn ||
        attributes[field.dependsOn.key] === field.dependsOn.value;
      if (!appliesToTransaction || !meetsDependency) {
        if (value !== undefined)
          throw new BadRequestException(`${field.label} is not applicable`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'number') {
          const numberValue =
            typeof value === 'number'
              ? value
              : typeof value === 'string' && value.trim() !== ''
                ? Number(value)
                : NaN;
          if (
            !Number.isInteger(numberValue) ||
            numberValue < (field.min ?? 0)
          ) {
            throw new BadRequestException(
              `${field.label} must be a whole number of at least ${field.min ?? 0}`,
            );
          }
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
      if (
        (value === undefined || value === null || value === '') &&
        (legacyValue === undefined ||
          legacyValue === null ||
          legacyValue === '')
      ) {
        throw new BadRequestException(
          `${field.label} is required for this listing category`,
        );
      }
    }

    this.assertConditionalFee(
      attributes,
      'brokerageFeeApplicable',
      'brokerageFee',
      'Brokerage fee',
    );
    this.assertConditionalFee(
      attributes,
      'maintenanceFeeApplicable',
      'monthlyMaintenanceFee',
      'Monthly maintenance fee',
    );
  }

  private assertConditionalFee(
    attributes: Record<string, unknown>,
    applicableKey: string,
    amountKey: string,
    label: string,
  ): void {
    const applicable = attributes[applicableKey];
    const amount = attributes[amountKey];
    if (
      applicable !== undefined &&
      applicable !== 'yes' &&
      applicable !== 'no'
    ) {
      throw new BadRequestException(
        `Invalid ${label.toLowerCase()} applicability`,
      );
    }
    if (applicable === 'yes') {
      const numericAmount =
        typeof amount === 'number'
          ? amount
          : typeof amount === 'string' && amount.trim() !== ''
            ? Number(amount)
            : NaN;
      if (!Number.isInteger(numericAmount) || numericAmount < 0)
        throw new BadRequestException(`${label} amount is required`);
    } else if (amount !== undefined && amount !== null && amount !== '') {
      throw new BadRequestException(
        `${label} amount requires applicability to be Yes`,
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

  private cdnBase(): string {
    return this.config.get<string>('CDN_BASE_URL') ?? '';
  }

  private toDetailDto(
    listing: Listing & {
      city: City;
      area: Area;
      listingPhotos: ListingPhoto[];
      listingVideos: ListingVideo[];
      owner: { agentProUntil: Date | null; phone: string | null; email: string | null };
      listingRenewals: ListingRenewal[];
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
      description: listing.description,
      status: listing.status,
      moderationState: listing.moderationState,
      adminReviewed: listing.adminReviewed,
      moderatedAt: listing.moderatedAt?.toISOString() ?? null,
      attributes: listing.attributes as Record<string, unknown>,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
      isExpired: listing.expiresAt.getTime() < Date.now(),
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
      renewalHistory: isOwnerOrAdmin
        ? listing.listingRenewals.map((r) => ({
            from: r.previousExpiresAt.toISOString(),
            to: r.newExpiresAt.toISOString(),
            renewedAt: r.renewedAt.toISOString(),
          }))
        : undefined,
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

  private toCardDto(
    listing: Listing & {
      city: City;
      area: Area;
      listingPhotos: ListingPhoto[];
      listingVideos: ListingVideo[];
      owner: { phone: string | null; email: string | null };
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
      price: listing.price === 0 ? 'Contact for price' : `₹${priceFormatter.format(listing.price)}`,
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
      isBoosted: (listing.boostedUntil?.getTime() ?? 0) > Date.now(),
      isOwner: viewerId !== undefined && viewerId === listing.ownerId,
      // Browse-card badge only — not gated on isOwnerOrAdmin like toDetailDto's `videos` array,
      // since "does this listing have a playable video at all" is fine as public info once done.
      hasVideo: listing.listingVideos.some((v) => v.status === 'done'),
      ...(revealStates?.get(listing.id) ?? { contactRevealed: false, ownerPhone: null, ownerEmail: null }),
    };
  }
}
