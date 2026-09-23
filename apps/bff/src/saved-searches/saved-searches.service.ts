import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Area, City, Listing, SavedSearch } from '@prisma/client';
import type { SavedSearchDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from '../locations/locations.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

/** Same single-row convention as CONTACT_REVEAL_SETTINGS_ID. */
export const SAVED_SEARCH_SETTINGS_ID = 'saved-search-settings';

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

  /** Settings singleton, created on first read — same id convention and lazy-create as
   * ContactRevealService's. */
  async getSettings(): Promise<{ freeAlertsPerUser: number }> {
    const existing = await this.prisma.savedSearchSetting.findUnique({ where: { id: SAVED_SEARCH_SETTINGS_ID } });
    if (existing) return { freeAlertsPerUser: existing.freeAlertsPerUser };
    const created = await this.prisma.savedSearchSetting.create({ data: { id: SAVED_SEARCH_SETTINGS_ID } });
    return { freeAlertsPerUser: created.freeAlertsPerUser };
  }

  async updateSettings(freeAlertsPerUser: number): Promise<{ freeAlertsPerUser: number }> {
    const row = await this.prisma.savedSearchSetting.upsert({
      where: { id: SAVED_SEARCH_SETTINGS_ID },
      update: { freeAlertsPerUser },
      create: { id: SAVED_SEARCH_SETTINGS_ID, freeAlertsPerUser },
    });
    return { freeAlertsPerUser: row.freeAlertsPerUser };
  }

  /** Whether this user can create another alert, and which bucket it would come out of — so a
   * caller can decide what to promise *before* offering it. `null` means they can't. */
  async alertAllowance(userId: string): Promise<{ source: 'plus' | 'free'; freeRemaining: number } | null> {
    const [user, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } }),
      this.getSettings(),
    ]);
    const freeUsed = await this.prisma.savedSearch.count({ where: { userId, source: 'free' } });
    const freeRemaining = Math.max(0, settings.freeAlertsPerUser - freeUsed);

    if (user?.premiumUntil && user.premiumUntil.getTime() > Date.now()) return { source: 'plus', freeRemaining };
    return freeRemaining > 0 ? { source: 'free', freeRemaining } : null;
  }

  /** Plus, or the per-user free quota — see SavedSearch.source and SavedSearchSetting.
   *
   * This used to be Plus-only, which made the whole feature unusable: there have never been any
   * Plus subscribers, so a built alert system had zero rows and the empty-result prompt could not
   * honestly promise anything. The quota is counted from rows already marked "free", exactly as
   * ContactRevealService counts free reveals. */
  async create(userId: string, dto: CreateSavedSearchDto): Promise<SavedSearchDto> {
    const allowance = await this.alertAllowance(userId);
    if (!allowance) {
      throw new ForbiddenException('Bhavano Plus is required for more saved search alerts');
    }

    const { areaName, ...rest } = dto;
    if (areaName && !rest.areaId) {
      if (!rest.cityId) throw new BadRequestException('cityId is required to add a new area');
      rest.areaId = (await this.locationsService.ensureArea(rest.cityId, areaName)).id;
    }

    const saved = await this.prisma.savedSearch.create({
      data: { userId, ...rest, source: allowance.source },
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
   * though the rows themselves aren't deleted when a subscription expires.
   *
   * Takes `city`/`area` alongside the plain `Listing` row — needed so `notifySavedSearchMatch`'s
   * button can link straight to the matching listing (`buildListingPath` needs the names, not
   * just the ids this row alone carries). The caller already has both included from its own
   * post-create re-fetch, so this costs no extra query. */
  async notifyMatchingBuyers(listing: Listing & { city: City; area: Area }): Promise<void> {
    const candidates = await this.prisma.savedSearch.findMany({
      where: {
        // A "free" alert is honoured regardless of subscription state — it was promised to
        // someone who had not paid, and silently never firing would be worse than not offering
        // it. A "plus" alert only fires while that subscription is live, so someone who lapses
        // keeps their free allowance and loses the rest. See SavedSearch.source.
        OR: [{ source: 'free' }, { user: { premiumUntil: { gt: new Date() } } }],
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
        const channel = await this.notificationsService.notifySavedSearchMatch(
          s.user,
          {
            id: listing.id,
            slug: listing.slug,
            category: listing.category,
            transactionType: listing.transactionType,
            cityName: listing.city.name,
            area: listing.area.name,
            title: listing.title,
          },
          s.name,
        );
        if (channel) {
          await this.prisma.listingNotificationLog.create({
            data: { listingId: listing.id, kind: 'saved_search_match', channel },
          });
        }
        await this.prisma.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } });
      }),
    );
  }
}
