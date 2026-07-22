import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminListingsPage,
  CreateListingInput,
  HomeCategoryFilter,
  ListingCardDto,
  ListingCategory,
  ListingDetailDto,
  ListingSitemapEntry,
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
import { getPriceQualifierOptions } from '@bhavano/types/priceQualifiers';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';
import type { Area, City, Listing, ListingPhoto } from '@prisma/client';
import { PHOTO_VARIANTS, PhotoVariant, variantUrl } from '../uploads/photo-keys';
import { ListListingsDto } from './dto/list-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { AdminListingSort, ListAdminListingsDto } from '../admin/dto/list-admin-listings.dto';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { LocationsService } from '../locations/locations.service';

/** Fixed for now — a future paid-plan tier would compute a different duration here
 * instead of this flat constant, without needing any schema change. */
const DEFAULT_LISTING_DURATION_DAYS = 30;

/** Property types nested under each of the Buy / Rent & Lease browsing tabs — nobody
 * buys/sells Storage or Coworking, so those only appear under Rent & Lease. */
const PROPERTY_TYPES_BY_TAB: Record<'buy' | 'rentLease', PropertyTypeFilter[]> = {
  buy: ['house', 'apartment', 'villa', 'plot', 'commercial'],
  rentLease: ['house', 'apartment', 'villa', 'storage', 'coworking', 'commercial'],
};

function buildHomeCategoryWhere(tab: HomeCategoryFilter | undefined, propertyType?: PropertyTypeFilter): Prisma.ListingWhereInput {
  // No tab and no raw category/transactionType bypass (checked by the caller before reaching
  // here) means a genuinely unfiltered request — the SEO city-root page, which has no
  // narrower grouping to fall back to.
  if (!tab) return {};
  if (tab === 'pg') return { category: 'pg' };
  if (tab === 'furniture') return { category: 'furniture' };
  if (tab === 'interiors') return { category: 'interiors' };

  const transactionTypes: TransactionType[] = tab === 'buy' ? ['buy', 'sell'] : ['rent', 'lease'];
  const allowedCategories = PROPERTY_TYPES_BY_TAB[tab];
  const categories = propertyType && allowedCategories.includes(propertyType) ? [propertyType] : allowedCategories;

  return { transactionType: { in: transactionTypes }, category: { in: categories } };
}

/** Every browse page's "Sort By" control — same 4 options for every category, all plain
 * top-level columns. `id: 'asc'` is a tie-breaker in every entry (not just the default), for the
 * same reason it's needed on the default: without it, offset-window pagination can silently shift
 * between requests when rows share an identical sort-key value. */
const ORDER_BY: Record<NonNullable<ListListingsDto['sort']>, Prisma.ListingOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { id: 'asc' }],
  popular: [{ viewCount: 'desc' }, { id: 'asc' }],
};

/** Same tie-breaker convention as ORDER_BY above, for the admin listings screen's own
 * (smaller) set of sort options. */
const ADMIN_ORDER_BY: Record<AdminListingSort, Prisma.ListingOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
  updatedAt_desc: [{ updatedAt: 'desc' }, { id: 'asc' }],
  updatedAt_asc: [{ updatedAt: 'asc' }, { id: 'asc' }],
};

const priceFormatter = new Intl.NumberFormat('en-IN');

const LISTING_PHOTOS_INCLUDE = { listingPhotos: { orderBy: { photoNo: 'asc' as const } } };

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly savedSearchesService: SavedSearchesService,
    private readonly locationsService: LocationsService,
  ) {}

  async list(query: ListListingsDto, currentUserId?: string): Promise<ListingsPage> {
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
        ? { ...(category ? { category } : {}), ...(transactionType ? { transactionType } : {}) }
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
          n >= MAX_BEDROOMS ? { attributes: { path: ['bedrooms'], gte: n } } : { attributes: { path: ['bedrooms'], equals: n } },
        ),
      });
    }
    if (furnished) attributeFilters.push({ attributes: { path: ['furnished'], equals: furnished } });
    if (sharingType) attributeFilters.push({ attributes: { path: ['sharingType'], equals: sharingType } });
    if (condition) attributeFilters.push({ attributes: { path: ['condition'], equals: condition } });
    if (serviceType) attributeFilters.push({ attributes: { path: ['serviceType'], equals: serviceType } });

    const where: Prisma.ListingWhereInput = {
      ...categoryWhere,
      status: 'active',
      moderationState: 'approved',
      expiresAt: { gt: new Date() },
      ...(cityId ? { cityId } : {}),
      ...(ownerId ? { ownerId } : {}),
      // `areaIds` (the multi-select browse filter) wins over the single `areaId` (the SEO
      // locality path) when both are somehow present — they're never sent together in practice.
      ...(areaIds && areaIds.length > 0 ? { areaId: { in: areaIds } } : areaId ? { areaId } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? { price: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
        : {}),
      ...(attributeFilters.length > 0 ? { AND: attributeFilters } : {}),
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
            include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
            orderBy,
            skip: offset,
            take: limit,
          })
        : this.prisma.listing.findMany({
            where,
            include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
            orderBy,
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          }),
      this.prisma.listing.count({ where }),
    ]);

    if (offset !== undefined) {
      const favouritedIds = await this.getFavouritedIds(currentUserId, rows.map((r) => r.id));
      return {
        items: rows.map((row) => this.toCardDto(row, favouritedIds)),
        nextCursor: null,
        total,
      };
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const favouritedIds = await this.getFavouritedIds(currentUserId, page.map((r) => r.id));

    return {
      items: page.map((row) => this.toCardDto(row, favouritedIds)),
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
      cityId,
      areaId,
      userId,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      sort,
      cursor,
      limit,
    } = query;
    const where: Prisma.ListingWhereInput = {
      ...(moderationState ? { moderationState } : {}),
      ...(adminReviewed !== undefined ? { adminReviewed } : {}),
      ...(category ? { category } : {}),
      ...(transactionType ? { transactionType } : {}),
      ...(cityId ? { cityId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(userId ? { ownerId: userId } : {}),
      ...(createdFrom || createdTo
        ? { createdAt: { ...(createdFrom ? { gte: new Date(createdFrom) } : {}), ...(createdTo ? { lte: new Date(createdTo) } : {}) } }
        : {}),
      ...(updatedFrom || updatedTo
        ? { updatedAt: { ...(updatedFrom ? { gte: new Date(updatedFrom) } : {}), ...(updatedTo ? { lte: new Date(updatedTo) } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
        orderBy: ADMIN_ORDER_BY[sort ?? 'createdAt_desc'],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.listing.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => this.toDetailDto(row)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  async setAdminReviewed(id: string, adminReviewed: boolean): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { adminReviewed },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });
    return this.toDetailDto(listing);
  }

  /** Takes a listing offline (this IS the soft-delete — see ModerationState) and marks it
   * reviewed. Posting the discrepancy message to the owner is the caller's (AdminService's)
   * job, via MessagingService, so this stays a plain listing-state mutation. */
  async flag(id: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { moderationState: 'flagged', adminReviewed: true, moderatedAt: new Date() },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });
    return this.toDetailDto(listing);
  }

  /** Puts a previously-flagged listing back in front of buyers. */
  async approve(id: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { moderationState: 'approved', adminReviewed: true, moderatedAt: new Date() },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });
    return this.toDetailDto(listing);
  }

  /** A flagged listing (taken down for review — see `flag()`) 404s for everyone except its own
   * owner and admins, same as if it didn't exist — otherwise anyone who already had the direct
   * link (e.g. shared before moderation caught it) could keep viewing the flagged photos/content
   * even though it's been pulled from browse/search. */
  async findOne(id: string, currentUser?: { id: string; role: UserRole }): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);

    const isOwnerOrAdmin = currentUser?.id === listing.ownerId || currentUser?.role === 'admin';
    if (listing.moderationState === 'flagged' && !isOwnerOrAdmin) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    const favouritedIds = await this.getFavouritedIds(currentUser?.id, [id]);
    return this.toDetailDto(listing, favouritedIds);
  }

  async create(input: CreateListingInput, ownerId: string): Promise<ListingDetailDto> {
    if (!input.photos.length) throw new BadRequestException('At least one photo is required');
    this.assertRequiredAttributes(input.category, input.attributes ?? {});
    this.assertValidPriceQualifier(input.category, input.transactionType, input.priceQualifier);

    const moderation = await this.moderationService.moderate(input);
    if (!moderation.ok) throw new BadRequestException(moderation.reason);

    const areaId = input.areaId ?? (await this.locationsService.ensureArea(input.cityId, input.areaName)).id;
    const expiresAt = new Date(Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

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
        attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
        tag: deriveTag(input),
        ownerId,
        expiresAt,
      },
    });

    await this.prisma.listingPhoto.createMany({
      data: input.photos.map((p) => ({ listingId: created.id, photoNo: p.photoNo, hash: p.hash })),
    });
    const variants = Object.keys(PHOTO_VARIANTS) as PhotoVariant[];
    await this.prisma.photoVariantJob.createMany({
      data: input.photos.flatMap((p) =>
        variants.map((variant) => ({ listingId: created.id, photoNo: p.photoNo, ext: p.ext, variant })),
      ),
    });

    const listing = await this.prisma.listing.findUniqueOrThrow({
      where: { id: created.id },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });

    // Fire-and-forget — Bhavano Plus's early-access alerts should never add latency to (or
    // break) the poster's own submission.
    this.savedSearchesService.notifyMatchingBuyers(created).catch(() => undefined);

    return this.toDetailDto(listing);
  }

  async listMine(userId: string): Promise<ListingDetailDto[]> {
    const listings = await this.prisma.listing.findMany({
      where: { ownerId: userId },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
      orderBy: { createdAt: 'desc' },
    });

    return listings.map((listing) => this.toDetailDto(listing));
  }

  async getMine(userId: string, id: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

    return this.toDetailDto(listing);
  }

  async update(id: string, userId: string, dto: UpdateListingDto): Promise<ListingDetailDto> {
    const existing = await this.prisma.listing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);
    if (existing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

    if (dto.attributes !== undefined) this.assertRequiredAttributes(existing.category, dto.attributes);
    if (dto.priceQualifier !== undefined) {
      this.assertValidPriceQualifier(existing.category, existing.transactionType, dto.priceQualifier);
    }

    const listing = await this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.priceQualifier !== undefined ? { priceQualifier: dto.priceQualifier } : {}),
        ...(dto.title !== undefined ? { title: dto.title, slug: slugify(dto.title) } : {}),
        ...(dto.specs !== undefined ? { specs: dto.specs } : {}),
        ...(dto.attributes !== undefined ? { attributes: dto.attributes as Prisma.InputJsonValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        // An owner editing a flagged listing IS the resubmission — flip adminReviewed back
        // to false so it resurfaces in the admin queue as needing another look. Approving/
        // flagging again is still required to actually change moderationState.
        ...(existing.moderationState === 'flagged' ? { adminReviewed: false } : {}),
      },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });

    return this.toDetailDto(listing);
  }

  /** Top (category, transactionType, city) combinations by real inventory — feeds the
   * "Popular searches" section below the search bar. There's no search-query telemetry to mine
   * (search is just a title filter, never logged), so this is the closest real signal: summed
   * `viewCount` across active listings in each bucket, which favors combinations people actually
   * look at over ones that merely have the most postings. `cityId` narrows this to one city's own
   * popular combinations (still grouped by cityId regardless, so this is just an extra `where`
   * clause, not a different query shape) — omit it for the site-wide ranking. */
  async getPopularSearches(limit = 6, cityId?: string): Promise<PopularSearchDto[]> {
    const groups = await this.prisma.listing.groupBy({
      by: ['category', 'transactionType', 'cityId'],
      where: { status: 'active', moderationState: 'approved', expiresAt: { gt: new Date() }, ...(cityId ? { cityId } : {}) },
      _sum: { viewCount: true },
      _count: { _all: true },
      orderBy: { _sum: { viewCount: 'desc' } },
      take: limit,
    });
    if (groups.length === 0) return [];

    const cities = await this.prisma.city.findMany({ where: { id: { in: [...new Set(groups.map((g) => g.cityId))] } } });
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
      where: { status: 'active', moderationState: 'approved', expiresAt: { gt: new Date() } },
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
  async recordView(listingId: string, viewerKey: string): Promise<{ viewCount: number }> {
    try {
      await this.prisma.listingView.create({ data: { listingId, viewerKey } });
      const listing = await this.prisma.listing.update({
        where: { id: listingId },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      });
      return { viewCount: listing.viewCount };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const listing = await this.prisma.listing.findUniqueOrThrow({ where: { id: listingId }, select: { viewCount: true } });
        return { viewCount: listing.viewCount };
      }
      throw error;
    }
  }

  async toggleFavourite(listingId: string, userId: string): Promise<{ favourited: boolean; likeCount: number }> {
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
      select: { likeCount: true, title: true, ownerId: true, boostedUntil: true },
    });

    // Fire-and-forget — a slow/failed notification should never add latency to (or break)
    // the favouriter's own click. Boost-only (see NotificationsService.notifyListingLiked):
    // an unboosted listing can rack up many low-intent likes, a boosted one is a smaller,
    // more engaged set where this is a meaningful signal instead of notification noise.
    const isBoosted = (listing.boostedUntil?.getTime() ?? 0) > Date.now();
    if (isBoosted && listing.ownerId !== userId) {
      this.notifyOwnerOfLike(listing.ownerId, userId, listing.title).catch(() => undefined);
    }

    return { favourited: true, likeCount: listing.likeCount };
  }

  private async notifyOwnerOfLike(ownerId: string, likerId: string, listingTitle: string): Promise<void> {
    const [owner, liker] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: ownerId }, select: { email: true, phone: true } }),
      this.prisma.user.findUnique({ where: { id: likerId }, select: { name: true } }),
    ]);
    if (!owner) return;
    await this.notificationsService.notifyListingLiked(owner, listingTitle, liker?.name ?? 'Someone');
  }

  async listFavourites(userId: string): Promise<ListingCardDto[]> {
    const favourites = await this.prisma.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { listing: { include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE } } },
    });
    const favouritedIds = new Set(favourites.map((f) => f.listingId));
    return favourites.map((f) => this.toCardDto(f.listing, favouritedIds));
  }

  private async getFavouritedIds(userId: string | undefined, listingIds: string[]): Promise<Set<string>> {
    if (!userId || listingIds.length === 0) return new Set();
    const rows = await this.prisma.favourite.findMany({
      where: { userId, listingId: { in: listingIds } },
      select: { listingId: true },
    });
    return new Set(rows.map((r) => r.listingId));
  }

  /** Category-specific "core" fields (bedrooms, sharing type, condition, etc.) marked
   * `required` in CATEGORY_FIELD_CONFIG — the single source of truth also driving the
   * posting wizard and edit form's UI. */
  private assertRequiredAttributes(category: ListingCategory, attributes: Record<string, unknown>): void {
    for (const field of CATEGORY_FIELD_CONFIG[category]) {
      if (!field.required) continue;
      const value = attributes[field.key];
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(`${field.label} is required for this listing category`);
      }
    }
  }

  private assertValidPriceQualifier(
    category: ListingCategory,
    transactionType: TransactionType,
    priceQualifier: string | undefined,
  ): void {
    const validValues = getPriceQualifierOptions(category, transactionType).map((o) => o.value);
    if (!validValues.includes(priceQualifier ?? '')) {
      throw new BadRequestException('Invalid price qualifier for this category/transaction type');
    }
  }

  private cdnBase(): string {
    return this.config.get<string>('CDN_BASE_URL') ?? '';
  }

  private toDetailDto(
    listing: Listing & { city: City; area: Area; listingPhotos: ListingPhoto[] },
    favouritedIds?: Set<string>,
  ): ListingDetailDto {
    return {
      ...this.toCardDto(listing, favouritedIds),
      status: listing.status,
      moderationState: listing.moderationState,
      adminReviewed: listing.adminReviewed,
      moderatedAt: listing.moderatedAt?.toISOString() ?? null,
      attributes: listing.attributes as Record<string, unknown>,
      createdAt: listing.createdAt.toISOString(),
      updatedAt: listing.updatedAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
      isExpired: listing.expiresAt.getTime() < Date.now(),
      photosFull: listing.listingPhotos.map((p) => variantUrl(this.cdnBase(), listing.id, p.photoNo, 'full')),
    };
  }

  private toCardDto(
    listing: Listing & { city: City; area: Area; listingPhotos: ListingPhoto[] },
    favouritedIds?: Set<string>,
  ): ListingCardDto {
    const placeholder = categoryImagePlaceholder[listing.category];
    const hasPhoto = listing.listingPhotos.length > 0;

    return {
      id: listing.id,
      category: listing.category,
      transactionType: listing.transactionType,
      slug: listing.slug,
      tag: listing.tag,
      price: `₹${priceFormatter.format(listing.price)}`,
      priceQualifier: listing.priceQualifier,
      title: listing.title,
      area: listing.area.name,
      cityName: listing.city.name,
      specs: listing.specs,
      imgLabel: hasPhoto ? '' : placeholder.imgLabel,
      imgColors: [placeholder.imgA, placeholder.imgB],
      photos: listing.listingPhotos.map((p) => variantUrl(this.cdnBase(), listing.id, p.photoNo, 'preview')),
      viewCount: listing.viewCount,
      likeCount: listing.likeCount,
      isFavourited: favouritedIds?.has(listing.id) ?? false,
      isBoosted: (listing.boostedUntil?.getTime() ?? 0) > Date.now(),
    };
  }
}
