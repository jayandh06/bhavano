import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateListingInput,
  HomeCategoryFilter,
  ListingCardDto,
  ListingDetailDto,
  ListingSitemapEntry,
  ListingsPage,
  PropertyTypeFilter,
  TransactionType,
} from '@bhavano/types';
import { categoryImagePlaceholder } from '@bhavano/types/tokens';
import { slugify } from '@bhavano/types/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { Prisma } from '@prisma/client';
import type { Area, City, Listing } from '@prisma/client';
import { ListListingsDto } from './dto/list-listings.dto';

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

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
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
        include: { city: true, area: true },
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

  async findOne(id: string, currentUserId?: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id }, include: { city: true, area: true } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);

    const favouritedIds = await this.getFavouritedIds(currentUserId, [id]);

    return {
      ...this.toCardDto(listing, favouritedIds),
      attributes: listing.attributes as Record<string, unknown>,
      createdAt: listing.createdAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
      isExpired: listing.expiresAt.getTime() < Date.now(),
    };
  }

  async create(input: CreateListingInput): Promise<ListingDetailDto> {
    const moderation = await this.moderationService.moderate(input);
    if (!moderation.ok) throw new BadRequestException(moderation.reason);

    const owner = await this.ensureAnonymousOwner();
    const areaId = input.areaId ?? (await this.ensureArea(input.cityId, input.areaName)).id;
    const expiresAt = new Date(Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const listing = await this.prisma.listing.create({
      data: {
        category: input.category,
        transactionType: input.transactionType,
        price: input.price,
        priceQualifier: input.priceQualifier ?? '',
        title: input.title,
        slug: slugify(input.title),
        areaId,
        cityId: input.cityId,
        specs: input.specs ?? [],
        photos: input.photos ?? [],
        attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
        tag: deriveTag(input),
        ownerId: owner.id,
        expiresAt,
      },
      include: { city: true, area: true },
    });

    if (input.photoHashes?.length) {
      await this.prisma.photoHash.createMany({
        data: input.photoHashes.map((hash) => ({ hash, listingId: listing.id })),
      });
    }

    return {
      ...this.toCardDto(listing),
      attributes: listing.attributes as Record<string, unknown>,
      createdAt: listing.createdAt.toISOString(),
      expiresAt: listing.expiresAt.toISOString(),
      isExpired: false,
    };
  }

  /** Minimal fields for every active, non-expired listing — feeds the web app's sitemap.xml. */
  async findAllForSitemap(): Promise<ListingSitemapEntry[]> {
    const listings = await this.prisma.listing.findMany({
      where: { status: 'active', expiresAt: { gt: new Date() } },
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
      include: { listing: { include: { city: true, area: true } } },
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

  private ensureAnonymousOwner() {
    return this.prisma.user.upsert({
      where: { email: ANONYMOUS_OWNER_EMAIL },
      update: {},
      create: { email: ANONYMOUS_OWNER_EMAIL, name: 'Anonymous' },
    });
  }

  private toCardDto(listing: Listing & { city: City; area: Area }, favouritedIds?: Set<string>): ListingCardDto {
    const placeholder = categoryImagePlaceholder[listing.category];
    const hasPhoto = listing.photos.length > 0;

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
      photos: listing.photos,
      viewCount: listing.viewCount,
      likeCount: listing.likeCount,
      isFavourited: favouritedIds?.has(listing.id) ?? false,
    };
  }
}
