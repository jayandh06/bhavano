import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Area, City, Listing, SavedSearch } from '@prisma/client';
import type { SavedSearchDto } from '@bhavano/types';
import { MAX_REQUIREMENT_AREAS } from '@bhavano/types/requirementQuestions';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationsService } from '../locations/locations.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

/** Same single-row convention as CONTACT_REVEAL_SETTINGS_ID. */
export const SAVED_SEARCH_SETTINGS_ID = 'saved-search-settings';

function toDto(saved: SavedSearch & { city: City | null }, areaNames: Map<string, string>): SavedSearchDto {
  return {
    id: saved.id,
    name: saved.name,
    category: saved.category ?? undefined,
    transactionType: saved.transactionType ?? undefined,
    cityId: saved.cityId ?? undefined,
    cityName: saved.city?.name,
    areaIds: saved.areaIds,
    areaNames: saved.areaIds.map((id) => areaNames.get(id) ?? '(deleted area)'),
    minPrice: saved.minPrice ?? undefined,
    maxPrice: saved.maxPrice ?? undefined,
    bedroomOptions: saved.bedroomOptions,
    createdAt: saved.createdAt.toISOString(),
  };
}

/** A listing's bedroom count matches an alert's bucket set exactly the way the browse filter's
 * own BHK buckets do (`ListingsService.list()`): the top bucket is "N or more", every other bucket
 * is exact. An empty bucket set means "any" — matches regardless of whether the listing even has a
 * bedroom count (a plot has none). */
function bedroomsMatch(bedroomOptions: number[], listingBedrooms: number | undefined): boolean {
  if (bedroomOptions.length === 0) return true;
  if (listingBedrooms === undefined) return false;
  return bedroomOptions.some((bucket) =>
    bucket >= MAX_BEDROOMS ? listingBedrooms >= MAX_BEDROOMS : listingBedrooms === bucket,
  );
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
    if (
      dto.minPrice !== undefined &&
      dto.maxPrice !== undefined &&
      dto.minPrice > dto.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }

    // areaName composes with areaIds rather than replacing it — picking three existing areas and
    // then typing a fourth, new one is one alert covering all four, capped at the same limit
    // Requirement.areaIds uses (MAX_REQUIREMENT_AREAS), since the DTO's own per-field cap can't see
    // the combined total.
    let areaIds = dto.areaIds ?? [];
    if (dto.areaName) {
      if (!dto.cityId) throw new BadRequestException('cityId is required to add a new area');
      const area = await this.locationsService.ensureArea(dto.cityId, dto.areaName);
      areaIds = [...new Set([...areaIds, area.id])];
    }
    areaIds = areaIds.slice(0, MAX_REQUIREMENT_AREAS);

    const saved = await this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        transactionType: dto.transactionType,
        cityId: dto.cityId,
        areaIds,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        bedroomOptions: dto.bedroomOptions ?? [],
        source: allowance.source,
      },
      include: { city: true },
    });
    return toDto(saved, await this.areaNamesFor(saved.areaIds));
  }

  async list(userId: string): Promise<SavedSearchDto[]> {
    const rows = await this.prisma.savedSearch.findMany({
      where: { userId },
      include: { city: true },
      orderBy: { createdAt: 'desc' },
    });
    const areaNames = await this.areaNamesFor(rows.flatMap((r) => r.areaIds));
    return rows.map((row) => toDto(row, areaNames));
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Saved search not found');
    await this.prisma.savedSearch.delete({ where: { id } });
  }

  /** Names for every area id any of these rows names, in one query — `areaIds` has no relation.
   * Same pattern as RequirementsService's own `areaNamesFor`. */
  private async areaNamesFor(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();
    const areas = await this.prisma.area.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true } });
    return new Map(areas.map((area) => [area.id, area.name]));
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
          // Empty areaIds means "whole city"; otherwise the listing's own area has to be one of
          // the ones named — same `has` semantics as ListingsService's own area-array filter.
          { OR: [{ areaIds: { isEmpty: true } }, { areaIds: { has: listing.areaId } }] },
          { OR: [{ minPrice: null }, { minPrice: { lte: listing.price } }] },
          { OR: [{ maxPrice: null }, { maxPrice: { gte: listing.price } }] },
        ],
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (candidates.length === 0) return;

    // Bedrooms lives in the listing's `attributes` JSONB, not a plain column shared across every
    // category, and bucket matching (5 = "5 or more") needs real comparison logic a Prisma `where`
    // can't express in one pass — checked in-memory rather than in the query above.
    const attributes = listing.attributes as Record<string, unknown>;
    const listingBedrooms = typeof attributes.bedrooms === 'number' ? attributes.bedrooms : undefined;
    const matches = candidates.filter((s) => bedroomsMatch(s.bedroomOptions, listingBedrooms));
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
