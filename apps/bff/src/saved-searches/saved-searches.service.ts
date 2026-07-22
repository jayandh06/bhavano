import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Area, City, Listing, SavedSearch } from '@prisma/client';
import type { SavedSearchDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from '../locations/locations.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

function toDto(saved: SavedSearch & { city: City | null; area: Area | null }): SavedSearchDto {
  return {
    id: saved.id,
    name: saved.name,
    category: saved.category ?? undefined,
    transactionType: saved.transactionType ?? undefined,
    cityId: saved.cityId ?? undefined,
    cityName: saved.city?.name,
    areaId: saved.areaId ?? undefined,
    areaName: saved.area?.name,
    minPrice: saved.minPrice ?? undefined,
    maxPrice: saved.maxPrice ?? undefined,
    bedrooms: saved.bedrooms ?? undefined,
    createdAt: saved.createdAt.toISOString(),
  };
}

@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly locationsService: LocationsService,
  ) {}

  /** Bhavano Plus-gated — the whole point of this feature is a Plus perk, not a free-tier one. */
  async create(userId: string, dto: CreateSavedSearchDto): Promise<SavedSearchDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } });
    if (!user?.premiumUntil || user.premiumUntil.getTime() <= Date.now()) {
      throw new ForbiddenException('Bhavano Plus is required to create saved search alerts');
    }

    const { areaName, ...rest } = dto;
    if (areaName && !rest.areaId) {
      if (!rest.cityId) throw new BadRequestException('cityId is required to add a new area');
      rest.areaId = (await this.locationsService.ensureArea(rest.cityId, areaName)).id;
    }

    const saved = await this.prisma.savedSearch.create({
      data: { userId, ...rest },
      include: { city: true, area: true },
    });
    return toDto(saved);
  }

  async list(userId: string): Promise<SavedSearchDto[]> {
    const rows = await this.prisma.savedSearch.findMany({
      where: { userId },
      include: { city: true, area: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Saved search not found');
    await this.prisma.savedSearch.delete({ where: { id } });
  }

  /** Fire-and-forget from ListingsService.create() right after a new listing is created —
   * matches it against every active Plus subscriber's saved-search criteria and notifies
   * immediately, instead of buyers having to keep re-checking browse pages themselves. A lapsed
   * subscriber's saved searches are never matched (the `user.premiumUntil` filter below), even
   * though the rows themselves aren't deleted when a subscription expires. */
  async notifyMatchingBuyers(listing: Listing): Promise<void> {
    const candidates = await this.prisma.savedSearch.findMany({
      where: {
        user: { premiumUntil: { gt: new Date() } },
        AND: [
          { OR: [{ category: null }, { category: listing.category }] },
          { OR: [{ transactionType: null }, { transactionType: listing.transactionType }] },
          { OR: [{ cityId: null }, { cityId: listing.cityId }] },
          { OR: [{ areaId: null }, { areaId: listing.areaId }] },
          { OR: [{ minPrice: null }, { minPrice: { lte: listing.price } }] },
          { OR: [{ maxPrice: null }, { maxPrice: { gte: listing.price } }] },
        ],
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (candidates.length === 0) return;

    // Bedrooms lives in the listing's `attributes` JSONB, not a plain column shared across every
    // category — checked in-memory rather than in the query above.
    const attributes = listing.attributes as Record<string, unknown>;
    const listingBedrooms = typeof attributes.bedrooms === 'number' ? attributes.bedrooms : undefined;
    const matches = candidates.filter((s) => s.bedrooms == null || s.bedrooms === listingBedrooms);
    if (matches.length === 0) return;

    await Promise.all(
      matches.map(async (s) => {
        await this.notificationsService.notifySavedSearchMatch(s.user, listing.title, s.name);
        await this.prisma.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } });
      }),
    );
  }
}
