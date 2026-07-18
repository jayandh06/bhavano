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
  ModerationState,
  PropertyTypeFilter,
  TransactionType,
} from '@bhavano/types';
import { categoryImagePlaceholder } from '@bhavano/types/tokens';
import { slugify } from '@bhavano/types/slugify';
import { CATEGORY_FIELD_CONFIG } from '@bhavano/types/categoryFields';
import { getPriceQualifierOptions } from '@bhavano/types/priceQualifiers';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { Prisma } from '@prisma/client';
import type { Area, City, Listing, ListingPhoto } from '@prisma/client';
import { PHOTO_VARIANTS, PhotoVariant, variantUrl } from '../uploads/photo-keys';
import { ListListingsDto } from './dto/list-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

const ANONYMOUS_OWNER_EMAIL = 'anonymous@bahavano.local';

/** Fixed for now — a future paid-plan tier would compute a different duration here
 * instead of this flat constant, without needing any schema change. */
const DEFAULT_LISTING_DURATION_DAYS = 30;

function deriveTag(input: Pick<CreateListingInput, 'category' | 'transactionType'>): string {
  if (input.category === 'coworking') return 'COWORKING';
  if (input.category === 'pg') return 'PG';
  if (input.category === 'furniture') return 'FURNITURE';
  if (input.category === 'storage') return 'STORAGE';
  return input.transactionType === 'rent' || input.transactionType === 'lease' ? 'FOR RENT' : 'FOR SALE';
}

/** Property types nested under each of the Buy / Rent & Lease browsing tabs — nobody
 * buys/sells Storage or Coworking, so those only appear under Rent & Lease. */
const PROPERTY_TYPES_BY_TAB: Record<'buy' | 'rentLease', PropertyTypeFilter[]> = {
  buy: ['house', 'apartment'],
  rentLease: ['house', 'apartment', 'storage', 'coworking'],
};

function buildHomeCategoryWhere(tab: HomeCategoryFilter, propertyType?: PropertyTypeFilter): Prisma.ListingWhereInput {
  if (tab === 'pg') return { category: 'pg' };
  if (tab === 'furniture') return { category: 'furniture' };

  const transactionTypes: TransactionType[] = tab === 'buy' ? ['buy', 'sell'] : ['rent', 'lease'];
  const allowedCategories = PROPERTY_TYPES_BY_TAB[tab];
  const categories = propertyType && allowedCategories.includes(propertyType) ? [propertyType] : allowedCategories;

  return { transactionType: { in: transactionTypes }, category: { in: categories } };
}

const priceFormatter = new Intl.NumberFormat('en-IN');

const LISTING_PHOTOS_INCLUDE = { listingPhotos: { orderBy: { photoNo: 'asc' as const } } };

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListListingsDto, currentUserId?: string): Promise<ListingsPage> {
    const {
      homeCategory = 'buy',
      propertyType,
      category,
      transactionType,
      cityId,
      areaId,
      q,
      minPrice,
      maxPrice,
      bedrooms,
      furnished,
      cursor,
      limit,
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
    if (bedrooms !== undefined) attributeFilters.push({ attributes: { path: ['bedrooms'], gte: bedrooms } });
    if (furnished) attributeFilters.push({ attributes: { path: ['furnished'], equals: furnished } });

    const where: Prisma.ListingWhereInput = {
      ...categoryWhere,
      status: 'active',
      moderationState: 'approved',
      expiresAt: { gt: new Date() },
      ...(cityId ? { cityId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? { price: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
        : {}),
      ...(attributeFilters.length > 0 ? { AND: attributeFilters } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.listing.count({ where }),
    ]);

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
  async listForAdmin(query: {
    moderationState?: ModerationState;
    adminReviewed?: boolean;
    category?: ListingCategory;
    cityId?: string;
    cursor?: string;
    limit: number;
  }): Promise<AdminListingsPage> {
    const { moderationState, adminReviewed, category, cityId, cursor, limit } = query;
    const where: Prisma.ListingWhereInput = {
      ...(moderationState ? { moderationState } : {}),
      ...(adminReviewed !== undefined ? { adminReviewed } : {}),
      ...(category ? { category } : {}),
      ...(cityId ? { cityId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
        orderBy: { createdAt: 'desc' },
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

  async findOne(id: string, currentUserId?: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { city: true, area: true, ...LISTING_PHOTOS_INCLUDE },
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);

    const favouritedIds = await this.getFavouritedIds(currentUserId, [id]);
    return this.toDetailDto(listing, favouritedIds);
  }

  // TEMP(auth-gate): posting is open without login for now — currentUserId is set when the
  // poster is logged in (so the listing shows up under their My Listings), otherwise it
  // falls back to the shared anonymous owner.
  async create(input: CreateListingInput, currentUserId?: string): Promise<ListingDetailDto> {
    if (!input.photos.length) throw new BadRequestException('At least one photo is required');
    this.assertRequiredAttributes(input.category, input.attributes ?? {});
    this.assertValidPriceQualifier(input.category, input.transactionType, input.priceQualifier);

    const moderation = await this.moderationService.moderate(input);
    if (!moderation.ok) throw new BadRequestException(moderation.reason);

    const ownerId = currentUserId ?? (await this.ensureAnonymousOwner()).id;
    const areaId = input.areaId ?? (await this.ensureArea(input.cityId, input.areaName)).id;
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
      select: { likeCount: true },
    });
    return { favourited: true, likeCount: listing.likeCount };
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

  /** Case-insensitive match against existing areas in the city first, so casing/whitespace
   * variants of an already-known area ("koramangala" vs "Koramangala") don't create a duplicate. */
  private async ensureArea(cityId: string, name?: string): Promise<Area> {
    if (!name?.trim()) throw new BadRequestException('Either areaId or areaName is required');
    const trimmed = name.trim();

    const existing = await this.prisma.area.findFirst({
      where: { cityId, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) return existing;

    return this.prisma.area.create({ data: { name: trimmed, cityId, source: 'user-submitted' } });
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

  private ensureAnonymousOwner() {
    return this.prisma.user.upsert({
      where: { email: ANONYMOUS_OWNER_EMAIL },
      update: {},
      create: { email: ANONYMOUS_OWNER_EMAIL, name: 'Anonymous' },
    });
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
    };
  }
}
