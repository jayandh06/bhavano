import { Injectable } from '@nestjs/common';
import type { ListingCategory } from '@bhavano/types';
import type {
  RequirementFeedCardDto,
  RequirementFeedCityCount,
  RequirementFeedDto,
  RequirementFeedFilters,
  RequirementFeedSummaryDto,
} from '@bhavano/types/requirementFeed';
import {
  budgetPresetsFor,
  formatRequirementLabel,
  intentOf,
  isLeadReady,
  type RequirementCriteria,
  type RequirementIntent,
} from '@bhavano/types/requirementQuestions';
import type { AreaUnit } from '@bhavano/types/areaUnit';
import type { City, Requirement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/guards/auth.guard';
import { areaNamesFor, criteriaOf } from './requirements.service';
import {
  feedDetails,
  listingFits,
  matchFeedFilters,
  normalizeTransaction,
  type FeedRow,
  type InventoryItem,
} from './requirement-feed';

/** Far above today's volume (under 100 open); the whole set is filtered in memory, which keeps the
 * "unanswered counts as a match" rules in one readable function instead of a SQL builder. Revisit
 * with real indexes when open requirements approach this. */
const FEED_SCAN_LIMIT = 2000;
const FEED_PAGE_LIMIT = 50;
/** A refine within this long of posting is part of posting, not an update worth flagging. */
const UPDATED_AFTER_MS = 10 * 60 * 1000;

type Row = Requirement & { city: City | null };

function headlineCriteria(criteria: RequirementCriteria): RequirementCriteria {
  const attributes = Object.fromEntries(
    Object.entries(criteria.attributes ?? {}).filter(
      ([key]) => key !== 'amenities',
    ),
  );
  return {
    ...criteria,
    minPrice: undefined,
    maxPrice: undefined,
    minAreaSqft: undefined,
    maxAreaSqft: undefined,
    attributes,
  };
}

/**
 * The owner/agent Requirements tab — docs/plans/requirements-feed-for-owners-agents.md.
 *
 * Only lead-ready requirements appear: one missing its areas, transaction or property type is too
 * vague for anyone to act on. Cards carry no seeker identity and none of the seeker's own words;
 * contact happens through the leads flow, never from here.
 */
@Injectable()
export class RequirementFeedService {
  constructor(private readonly prisma: PrismaService) {}

  private async leadReadyRows(excludeSeekerId?: string): Promise<Row[]> {
    const rows = await this.prisma.requirement.findMany({
      where: {
        status: { in: ['open', 'working'] },
        expiresAt: { gt: new Date() },
        cityId: { not: null },
        category: { not: null },
        transactionType: { not: null },
        ...(excludeSeekerId ? { seekerId: { not: excludeSeekerId } } : {}),
      },
      include: { city: true },
      orderBy: { createdAt: 'desc' },
      take: FEED_SCAN_LIMIT,
    });
    return rows.filter((row) => isLeadReady(criteriaOf(row)));
  }

  /**
   * Owners and agents only: a declared seller type, an active Agent Pro plan, or at least one live
   * listing. Admins always. Everyone else is asked which they are, which also fills in the
   * `sellerType` most accounts never set.
   */
  private async viewer(
    user: RequestUser,
  ): Promise<{ eligible: boolean; inventory: InventoryItem[] }> {
    const [profile, inventory] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { sellerType: true, agentProUntil: true },
      }),
      this.prisma.listing.findMany({
        where: {
          ownerId: user.id,
          status: 'active',
          publishState: 'live',
          moderationState: 'approved',
          expiresAt: { gt: new Date() },
        },
        select: {
          cityId: true,
          areaId: true,
          category: true,
          transactionType: true,
        },
        distinct: ['cityId', 'areaId', 'category', 'transactionType'],
      }),
    ]);
    const eligible =
      user.role === 'admin' ||
      profile?.sellerType != null ||
      (profile?.agentProUntil?.getTime() ?? 0) > Date.now() ||
      inventory.length > 0;
    return { eligible, inventory };
  }

  async feed(
    user: RequestUser,
    filters: RequirementFeedFilters,
  ): Promise<RequirementFeedDto> {
    const { eligible, inventory } = await this.viewer(user);
    const empty: RequirementFeedDto = {
      eligible,
      items: [],
      total: 0,
      hasListings: inventory.length > 0,
      facets: { cities: [], areas: [], intents: {}, categories: {} },
    };
    if (!eligible) return empty;

    const now = new Date();
    const rows = (await this.leadReadyRows(user.id)).map((row) => {
      const criteria = criteriaOf(row);
      const feedRow: FeedRow = {
        criteria,
        createdAt: row.createdAt,
        moveInBy: row.moveInBy,
        openToCalls: row.contactConsentAt !== null,
      };
      return {
        row,
        feedRow,
        fitCount: inventory.filter((item) => listingFits(criteria, item))
          .length,
      };
    });
    const test = (entry: (typeof rows)[number], f: RequirementFeedFilters) =>
      matchFeedFilters(entry.feedRow, f, { now, fitCount: entry.fitCount });

    const matched = rows.flatMap((entry) => {
      const result = test(entry, filters);
      return result.match ? [{ ...entry, unanswered: result.unanswered }] : [];
    });
    if (filters.sort === 'soonest') {
      const by = (d: Date | null) => d?.getTime() ?? Infinity;
      matched.sort(
        (a, b) =>
          by(a.row.moveInBy) - by(b.row.moveInBy) ||
          b.row.createdAt.getTime() - a.row.createdAt.getTime(),
      );
    }

    const withoutPlace = { ...filters, city: undefined, areas: undefined };
    const cityCounts = new Map<string, RequirementFeedCityCount>();
    for (const entry of rows) {
      if (!entry.row.city || !test(entry, withoutPlace).match) continue;
      const current = cityCounts.get(entry.row.city.id) ?? {
        cityId: entry.row.city.id,
        cityName: entry.row.city.name,
        count: 0,
      };
      current.count += 1;
      cityCounts.set(entry.row.city.id, current);
    }

    const areaCounts = new Map<string, number>();
    if (filters.city) {
      const withoutAreas = { ...filters, areas: undefined };
      for (const entry of rows) {
        if (!test(entry, withoutAreas).match) continue;
        for (const areaId of entry.row.areaIds) {
          areaCounts.set(areaId, (areaCounts.get(areaId) ?? 0) + 1);
        }
      }
    }

    const placeOnly: RequirementFeedFilters = {
      city: filters.city,
      areas: filters.areas,
    };
    const intents: Partial<Record<RequirementIntent, number>> = {};
    const categories: Partial<Record<ListingCategory, number>> = {};
    for (const entry of rows) {
      if (!test(entry, placeOnly).match) continue;
      const intent = intentOf(
        entry.row.category ?? undefined,
        entry.row.transactionType ?? undefined,
      );
      if (intent) intents[intent] = (intents[intent] ?? 0) + 1;
      if (!filters.intent || intent === filters.intent) {
        const category = entry.row.category!;
        categories[category] = (categories[category] ?? 0) + 1;
      }
    }

    const page = matched.slice(0, FEED_PAGE_LIMIT);
    const names = await areaNamesFor(this.prisma, [
      ...page.map((entry) => entry.row),
      ...rows
        .filter((entry) => entry.row.areaIds.some((id) => areaCounts.has(id)))
        .map((entry) => entry.row),
    ]);
    return {
      ...empty,
      items: page.map((entry) =>
        this.toCard(entry.row, names, entry.fitCount, entry.unanswered),
      ),
      total: matched.length,
      facets: {
        cities: [...cityCounts.values()].sort(
          (a, b) => b.count - a.count || a.cityName.localeCompare(b.cityName),
        ),
        areas: [...areaCounts.entries()]
          .flatMap(([areaId, count]) => {
            const name = names.get(areaId);
            return name ? [{ areaId, name, count }] : [];
          })
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        intents,
        categories,
      },
    };
  }

  private toCard(
    row: Row,
    names: Map<string, string>,
    fitCount: number,
    unanswered: string[],
  ): RequirementFeedCardDto {
    const criteria = criteriaOf(row);
    const areaNames = row.areaIds
      .map((id) => names.get(id))
      .filter((name): name is string => Boolean(name));
    const category = row.category!;
    const transactionType = normalizeTransaction(row.transactionType)!;
    const updated =
      row.refinedAt &&
      row.refinedAt.getTime() - row.createdAt.getTime() > UPDATED_AFTER_MS;
    return {
      id: row.id,
      // What and where only: budget, size and must-haves are shown as their own chips.
      label: formatRequirementLabel(headlineCriteria(criteria), {
        cityName: row.city?.name,
        areaNames,
      }),
      intent: intentOf(category, transactionType),
      category,
      transactionType,
      cityName: row.city?.name,
      areaNames,
      bedroomOptions: row.bedroomOptions,
      minPrice: row.minPrice ?? undefined,
      maxPrice: row.maxPrice ?? undefined,
      budgetUnit: budgetPresetsFor(category, transactionType).unit,
      minAreaSqft: row.minAreaSqft ?? undefined,
      maxAreaSqft: row.maxAreaSqft ?? undefined,
      areaUnit: (row.areaUnit as AreaUnit | null) ?? undefined,
      details: feedDetails(criteria),
      moveInBy: row.moveInBy?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: updated ? row.refinedAt!.toISOString() : undefined,
      openToCalls: row.contactConsentAt !== null,
      matchingListingCount: fitCount,
      unanswered,
    };
  }

  /** Counts only — what a signed-out visitor sees, and the pitch to owners who haven't listed. */
  async summary(cityId?: string): Promise<RequirementFeedSummaryDto> {
    const rows = await this.leadReadyRows();
    const cities = new Map<string, RequirementFeedCityCount>();
    const types = new Map<
      string,
      { intent: RequirementIntent; category: ListingCategory; count: number }
    >();
    for (const row of rows) {
      if (!row.city) continue;
      const city = cities.get(row.city.id) ?? {
        cityId: row.city.id,
        cityName: row.city.name,
        count: 0,
      };
      city.count += 1;
      cities.set(row.city.id, city);

      if (cityId && row.cityId !== cityId) continue;
      const intent = intentOf(
        row.category ?? undefined,
        row.transactionType ?? undefined,
      );
      if (!intent || !row.category) continue;
      const key = `${intent}:${row.category}`;
      const type = types.get(key) ?? {
        intent,
        category: row.category,
        count: 0,
      };
      type.count += 1;
      types.set(key, type);
    }
    return {
      total: cityId ? (cities.get(cityId)?.count ?? 0) : rows.length,
      cities: [...cities.values()].sort(
        (a, b) => b.count - a.count || a.cityName.localeCompare(b.cityName),
      ),
      types: [...types.values()].sort((a, b) => b.count - a.count),
    };
  }
}
