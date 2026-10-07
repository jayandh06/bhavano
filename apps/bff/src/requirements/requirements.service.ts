import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ListingCategory, OwnerRequirementMatchDto, RequirementDto, TransactionType } from '@bhavano/types';
import type { AreaUnit } from '@bhavano/types/areaUnit';
import {
  describeRequirementGaps,
  formatRequirementLabel,
  isLeadReady,
  missingForLead,
  isValidRequirementTransaction,
  sanitizeRequirementAttributes,
  sizeQuestionFor,
  type RequirementAttributes,
  type RequirementCriteria,
} from '@bhavano/types/requirementQuestions';
import { requirementBudgetIssue } from '@bhavano/types/priceBounds';
import { Prisma, type Area, type City, type Requirement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { RefineRequirementDto } from './dto/refine-requirement.dto';
import { UpdateMyRequirementDto } from './dto/update-my-requirement.dto';

/** Same 30-day life as a listing (DEFAULT_LISTING_DURATION_DAYS in listings.service.ts), and
 * renewable the same way. Requirements have to age out: an owner who wastes a call on someone
 * who moved three months ago stops trusting the queue, which costs more than the lead was
 * worth. */
export const REQUIREMENT_DURATION_DAYS = 30;

function expiryFromNow(): Date {
  return new Date(Date.now() + REQUIREMENT_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

type RequirementRow = Requirement & { city: City | null; area: Area | null };

function attributesOf(row: Requirement): RequirementAttributes {
  return row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes)
    ? (row.attributes as RequirementAttributes)
    : {};
}

/** The stored criteria in the shared vocabulary — what the label, lead-readiness and the
 * questions all read. */
export function criteriaOf(row: Requirement): RequirementCriteria {
  return {
    category: row.category ?? undefined,
    transactionType: row.transactionType ?? undefined,
    cityId: row.cityId ?? undefined,
    areaIds: row.areaIds,
    bedroomOptions: row.bedroomOptions,
    minPrice: row.minPrice ?? undefined,
    maxPrice: row.maxPrice ?? undefined,
    minAreaSqft: row.minAreaSqft ?? undefined,
    maxAreaSqft: row.maxAreaSqft ?? undefined,
    areaUnit: (row.areaUnit as AreaUnit | null) ?? undefined,
    attributes: attributesOf(row),
    moveInBy: row.moveInBy?.toISOString(),
  };
}

/** Criteria stay the seeker's to change only until someone has acted on them: an admin note or
 * status change, or owners told about it. After that they are what people were told, and a
 * changed need is a new requirement. */
export function canRefine(row: Requirement): boolean {
  return row.status === 'open' && !row.adminNote && !row.ownersNotifiedAt && row.expiresAt.getTime() > Date.now();
}

/**
 * What the paired `SavedSearch` alert should be told. Used to collapse `Requirement`'s multi-area/
 * multi-bedroom criteria onto `SavedSearch`'s single area and single bedroom count — that
 * limitation is gone as of 2026-09-30 (SavedSearch now carries `areaIds`/`bedroomOptions` arrays
 * too, see docs/plans/saved-search-multi-area-and-mandatory-fields.md), so this now passes
 * everything through unchanged rather than narrowing it. Kept as its own function only because the
 * field-by-field `?? undefined` mapping is still worth naming and sharing between the two call
 * sites (create and refine).
 */
function alertCriteria(c: {
  category?: ListingCategory | null;
  transactionType?: TransactionType | null;
  cityId?: string | null;
  areaIds: string[];
  bedroomOptions: number[];
  minPrice?: number | null;
  maxPrice?: number | null;
}) {
  return {
    category: c.category ?? undefined,
    transactionType: c.transactionType ?? undefined,
    cityId: c.cityId ?? undefined,
    areaIds: c.areaIds,
    minPrice: c.minPrice ?? undefined,
    maxPrice: c.maxPrice ?? undefined,
    bedroomOptions: c.bedroomOptions,
  };
}

/** `undefined` → `null`, for an update that must clear what a create would simply omit. */
function nullable<T extends Record<string, unknown>>(values: T): { [K in keyof T]: Exclude<T[K], undefined> | null } {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? null])) as {
    [K in keyof T]: Exclude<T[K], undefined> | null;
  };
}

/** Names for every area any of these rows names, in one query — `areaIds` has no relation. */
export async function areaNamesFor(prisma: PrismaService, rows: Requirement[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => row.areaIds))];
  if (ids.length === 0) return new Map();
  const areas = await prisma.area.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(areas.map((area) => [area.id, area.name]));
}

export function toRequirementDto(row: RequirementRow, areaNames: Map<string, string>): RequirementDto {
  return {
    id: row.id,
    searchLabel: row.searchLabel,
    category: row.category ?? undefined,
    transactionType: row.transactionType ?? undefined,
    cityId: row.cityId ?? undefined,
    cityName: row.city?.name,
    areaId: row.areaId ?? undefined,
    areaName: row.area?.name,
    areaIds: row.areaIds,
    areaNames: row.areaIds.map((id) => areaNames.get(id)).filter((name): name is string => Boolean(name)),
    minPrice: row.minPrice ?? undefined,
    maxPrice: row.maxPrice ?? undefined,
    bedrooms: row.bedrooms ?? undefined,
    bedroomOptions: row.bedroomOptions,
    minAreaSqft: row.minAreaSqft ?? undefined,
    maxAreaSqft: row.maxAreaSqft ?? undefined,
    areaUnit: (row.areaUnit as AreaUnit | null) ?? undefined,
    attributes: attributesOf(row),
    originalSearchLabel: row.originalSearchLabel ?? undefined,
    refinedAt: row.refinedAt?.toISOString(),
    isLeadReady: isLeadReady(criteriaOf(row)),
    canRefine: canRefine(row),
    landingPath: row.landingPath ?? undefined,
    note: row.note ?? undefined,
    moveInBy: row.moveInBy?.toISOString(),
    status: row.status,
    closedReason: row.closedReason ?? undefined,
    expiresAt: row.expiresAt.toISOString(),
    // Derived rather than stored, exactly as ListingDetailDto.isExpired is: a row can be past
    // its date for hours before any job gets to it, and every reader needs the same answer.
    isExpired: row.expiresAt.getTime() <= Date.now(),
    hasAlert: row.savedSearchId !== null,
    contactConsent: row.contactConsentAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Phase 0 of docs/plans/property-requirements-demand-side.md — capturing what a seeker wanted
 * and could not find, so the search is not a dead end.
 *
 * Two things happen per capture, and the second is allowed to fail:
 *
 *   1. The `Requirement` row, always. This is the durable record an admin works by hand — at
 *      current volume (1-3 a day) that is the actual matching engine, and it is also how the
 *      outreach module learns which areas to recruit owners in.
 *   2. A `SavedSearch` alert, when the seeker has one left (free quota or Plus). Best-effort:
 *      if it fails, the requirement still stands and the confirmation simply promises a person
 *      rather than an alert.
 */
@Injectable()
export class RequirementsService {
  private readonly logger = new Logger(RequirementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly savedSearchesService: SavedSearchesService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  private async toDto(row: RequirementRow): Promise<RequirementDto> {
    return toRequirementDto(row, await areaNamesFor(this.prisma, [row]));
  }

  /** Only the ids that are real areas of this city, in the order given, without repeats. */
  private async areasInCity(cityId: string | null | undefined, areaIds: string[]): Promise<string[]> {
    const unique = [...new Set(areaIds)];
    if (unique.length === 0 || !cityId) return [];
    const found = await this.prisma.area.findMany({ where: { id: { in: unique }, cityId }, select: { id: true } });
    const valid = new Set(found.map((area) => area.id));
    return unique.filter((id) => valid.has(id));
  }

  /**
   * Created once, at the end of the questions, with every answer — never half-filled. A
   * requirement missing its city, areas, buy/rent or property type is too vague for anyone to act
   * on, so it is refused rather than saved and "refined later". See
   * docs/plans/requirement-refinement-questions.md.
   */
  async create(userId: string, dto: CreateRequirementDto): Promise<RequirementDto> {
    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId }, select: { id: true, name: true } });
    if (!city) throw new BadRequestException('Pick a city first');

    const category = dto.category;
    const transactionType = dto.transactionType;
    if (category && transactionType && !isValidRequirementTransaction(category, transactionType)) {
      throw new BadRequestException(`A ${category} can't be had on ${transactionType}`);
    }

    // A foreign area id or a facet the category doesn't have is dropped, not refused — web sends
    // the browse page's own filters along, and those can carry more than a requirement holds.
    const areaIds = await this.areasInCity(city.id, dto.areaIds ?? (dto.areaId ? [dto.areaId] : []));
    const size = category ? sizeQuestionFor(category) : undefined;
    const bedroomOptions =
      size?.kind === 'bedrooms'
        ? [...new Set(dto.bedroomOptions ?? (dto.bedrooms ? [dto.bedrooms] : []))].sort((a, b) => a - b)
        : [];
    const minAreaSqft = size?.kind === 'area' ? dto.minAreaSqft : undefined;
    const maxAreaSqft = size?.kind === 'area' ? dto.maxAreaSqft : undefined;
    const areaUnit = size?.kind === 'area' && (minAreaSqft !== undefined || maxAreaSqft !== undefined) ? dto.areaUnit : undefined;
    if (minAreaSqft !== undefined && maxAreaSqft !== undefined && minAreaSqft > maxAreaSqft) {
      throw new BadRequestException('The smallest size is larger than the largest');
    }
    if (dto.minPrice !== undefined && dto.maxPrice !== undefined && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('The lowest budget is higher than the highest');
    }
    if (category && transactionType) {
      const budgetIssue =
        (dto.minPrice != null && requirementBudgetIssue(category, transactionType, dto.minPrice)) ||
        (dto.maxPrice != null && requirementBudgetIssue(category, transactionType, dto.maxPrice));
      if (budgetIssue) throw new BadRequestException(budgetIssue);
    }
    const attributes = category && dto.attributes
      ? sanitizeRequirementAttributes(category, transactionType, dto.attributes).attributes
      : {};

    const criteria: RequirementCriteria = {
      category,
      transactionType,
      cityId: city.id,
      areaIds,
      bedroomOptions,
      minPrice: dto.minPrice,
      maxPrice: dto.maxPrice,
      minAreaSqft,
      maxAreaSqft,
      areaUnit,
      attributes,
    };
    const missing = missingForLead(criteria);
    if (missing.length > 0) throw new BadRequestException(`Add ${describeRequirementGaps(missing)} first`);

    const names = await this.prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } });
    const nameById = new Map(names.map((area) => [area.id, area.name]));
    const searchLabel = formatRequirementLabel(criteria, {
      cityName: city.name,
      areaNames: areaIds.map((id) => nameById.get(id)).filter((name): name is string => Boolean(name)),
    });

    const savedSearchId = await this.tryCreateAlert(userId, { ...dto, searchLabel, areaIds, bedroomOptions });

    const requirement = await this.prisma.requirement.create({
      data: {
        seekerId: userId,
        searchLabel,
        originalSearchLabel: dto.searchLabel,
        category,
        transactionType,
        cityId: city.id,
        areaId: areaIds[0],
        areaIds,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        bedrooms: bedroomOptions[0],
        bedroomOptions,
        minAreaSqft,
        maxAreaSqft,
        areaUnit,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        landingPath: dto.landingPath,
        note: dto.note?.trim() || undefined,
        moveInBy: dto.moveInBy ? new Date(dto.moveInBy) : undefined,
        // Every question was in front of them before this was sent.
        refinedAt: new Date(),
        expiresAt: expiryFromNow(),
        savedSearchId,
        // Stamped at the moment they agreed, and only when they actually did — see the field's
        // own note on why this is a timestamp and not a flag.
        contactConsentAt: dto.contactConsent ? new Date() : null,
      },
      include: { city: true, area: true },
    });

    // Mirrors ListingsService.runPostLiveSideEffects: the server, not the visitor's device,
    // records that this actually happened — a fire-and-forget client-side page view can
    // silently drop, which is exactly what a "did they actually finish" signal cannot afford.
    // Absent for a caller with no browser/app session (there are none of those here today, but
    // the field is optional the same way CreateListingInput.sessionId is).
    if (dto.sessionId) {
      this.analyticsService
        .recordPageView({ sessionId: dto.sessionId, path: "/requirement/success" })
        .catch(() => undefined);
    }

    // Best-effort, like every other notification in the app: a failed send must not fail the
    // capture, which is the part that actually matters.
    const seeker = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (seeker) {
      await this.notificationsService
        .notifyRequirementCaptured(seeker, searchLabel, savedSearchId !== null)
        .catch((error: unknown) => {
          this.logger.error(`Requirement ${requirement.id} captured but confirmation failed: ${String(error)}`);
          return null;
        });
    }

    return this.toDto(requirement);
  }

  /** The alert half. Returns its id, or null when the seeker has no allowance left (or the
   * create failed) — the caller uses that to decide what the confirmation may promise. */
  private async tryCreateAlert(
    userId: string,
    criteria: CreateRequirementDto & { areaIds: string[]; bedroomOptions: number[] },
  ): Promise<string | null> {
    try {
      const allowance = await this.savedSearchesService.alertAllowance(userId);
      if (!allowance) return null;

      const saved = await this.savedSearchesService.create(userId, {
        name: criteria.searchLabel,
        ...alertCriteria(criteria),
      });
      return saved.id;
    } catch (error) {
      this.logger.warn(`Alert for a new requirement could not be created: ${String(error)}`);
      return null;
    }
  }

  /** The seeker's own captures — `/my-requirements`. */
  async listMine(userId: string): Promise<RequirementDto[]> {
    const rows = await this.prisma.requirement.findMany({
      where: { seekerId: userId },
      include: { city: true, area: true },
      orderBy: { createdAt: 'desc' },
    });
    const names = await areaNamesFor(this.prisma, rows);
    return rows.map((row) => toRequirementDto(row, names));
  }

  /** One of the seeker's own — what the refine page opens. */
  async getMine(userId: string, id: string): Promise<RequirementDto> {
    const row = await this.prisma.requirement.findFirst({ where: { id, seekerId: userId }, include: { city: true, area: true } });
    if (!row) throw new NotFoundException('Requirement not found');
    return this.toDto(row);
  }

  /**
   * One step of the refinement questions — docs/plans/requirement-refinement-questions.md.
   *
   * Relaxes Phase 1's "criteria are not editable" rule only as far as its reason allows: that
   * rule existed because an admin may already have worked the queue against them, so the criteria
   * stay editable exactly until anyone has (see `canRefine`). In practice the questions are
   * answered in the minute after capture, long before the morning digest or the match job.
   *
   * Each call merges into the row, re-validates the whole result (a category change can strand a
   * transaction type, a BHK set or a facet), rewrites the label from the criteria, and brings the
   * paired alert along. The seeker is not messaged again: the capture confirmation already went.
   */
  async refineMine(userId: string, id: string, dto: RefineRequirementDto): Promise<RequirementDto> {
    const existing = await this.prisma.requirement.findFirst({
      where: { id, seekerId: userId },
      include: { city: true, area: true },
    });
    if (!existing) throw new NotFoundException('Requirement not found');
    if (!canRefine(existing)) {
      throw new ConflictException(
        'This requirement is already being worked on, so it can no longer be changed. Close it and start a new one if what you need has changed.',
      );
    }

    const pick = <T>(next: T | null | undefined, current: T | null): T | null => (next === undefined ? current : next);
    const category: ListingCategory | null = pick(dto.category, existing.category);
    const transactionType: TransactionType | null = pick(dto.transactionType, existing.transactionType);
    if (category && transactionType && !isValidRequirementTransaction(category, transactionType)) {
      throw new BadRequestException(`A ${category} can't be had on ${transactionType}`);
    }

    let city = existing.city;
    if (dto.cityId !== undefined && dto.cityId !== existing.cityId) {
      city = await this.prisma.city.findUnique({ where: { id: dto.cityId } });
      if (!city) throw new BadRequestException('Unknown city');
    }
    const cityChanged = (city?.id ?? null) !== existing.cityId;

    // Areas belong to a city, so a new city drops the old ones unless new ones came with it.
    let areaIds = cityChanged ? [] : existing.areaIds;
    if (dto.areaIds !== undefined) {
      areaIds = await this.areasInCity(city?.id, dto.areaIds);
      if (areaIds.length !== new Set(dto.areaIds).size) throw new BadRequestException('Every area must be in the requirement’s city');
    }

    // Criteria that only mean something for some categories are cleared when the category no
    // longer has them, rather than left behind to confuse the label and the matchers.
    const size = category ? sizeQuestionFor(category) : undefined;
    const bedroomOptions =
      size?.kind === 'bedrooms' ? [...new Set(dto.bedroomOptions ?? existing.bedroomOptions)].sort((a, b) => a - b) : [];
    const minAreaSqft = size?.kind === 'area' ? pick(dto.minAreaSqft, existing.minAreaSqft) : null;
    const maxAreaSqft = size?.kind === 'area' ? pick(dto.maxAreaSqft, existing.maxAreaSqft) : null;
    const areaUnit = size?.kind === 'area' ? pick(dto.areaUnit, existing.areaUnit as AreaUnit | null) : null;
    if (minAreaSqft !== null && maxAreaSqft !== null && minAreaSqft > maxAreaSqft) {
      throw new BadRequestException('The smallest size is larger than the largest');
    }

    const minPrice = pick(dto.minPrice, existing.minPrice);
    const maxPrice = pick(dto.maxPrice, existing.maxPrice);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      throw new BadRequestException('The lowest budget is higher than the highest');
    }
    // Only the field(s) this patch actually sets, not the merged minPrice/maxPrice above — a
    // refine that doesn't touch budget at all must never start failing because a pre-existing
    // row already has a bad value stored (e.g. one saved before this check existed).
    if (category && transactionType) {
      const budgetIssue =
        (dto.minPrice != null && requirementBudgetIssue(category, transactionType, dto.minPrice)) ||
        (dto.maxPrice != null && requirementBudgetIssue(category, transactionType, dto.maxPrice));
      if (budgetIssue) throw new BadRequestException(budgetIssue);
    }

    let attributes: RequirementAttributes = {};
    if (category) {
      const result = sanitizeRequirementAttributes(category, transactionType ?? undefined, dto.attributes ?? attributesOf(existing));
      // Only what this request sent can be wrong; stale keys from before a category change are
      // simply dropped by the sanitizer.
      if (dto.attributes && result.errors.length > 0) throw new BadRequestException(result.errors.join('; '));
      attributes = result.attributes;
    }

    const moveInBy = dto.moveInBy === undefined ? existing.moveInBy : dto.moveInBy ? new Date(dto.moveInBy) : null;
    const note = dto.note === undefined ? existing.note : dto.note?.trim() || null;

    const criteria: RequirementCriteria = {
      category: category ?? undefined,
      transactionType: transactionType ?? undefined,
      cityId: city?.id,
      areaIds,
      bedroomOptions,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined,
      minAreaSqft: minAreaSqft ?? undefined,
      maxAreaSqft: maxAreaSqft ?? undefined,
      areaUnit: areaUnit ?? undefined,
      attributes,
    };
    // The review's Done is the seeker saying "that's what I need" — it can't be said of a row
    // still missing what makes it a requirement at all.
    const missing = missingForLead(criteria);
    if (dto.complete && missing.length > 0) {
      throw new BadRequestException(`Add ${describeRequirementGaps(missing)} first`);
    }
    const names = await areaNamesFor(this.prisma, [{ ...existing, areaIds }]);
    const searchLabel = formatRequirementLabel(criteria, {
      cityName: city?.name,
      areaNames: areaIds.map((areaId) => names.get(areaId)).filter((name): name is string => Boolean(name)),
    });

    const row = await this.prisma.requirement.update({
      where: { id },
      data: {
        category,
        transactionType,
        ...(cityChanged && city ? { cityId: city.id } : {}),
        areaIds,
        areaId: areaIds[0] ?? null,
        bedroomOptions,
        bedrooms: bedroomOptions[0] ?? null,
        minAreaSqft,
        maxAreaSqft,
        areaUnit,
        minPrice,
        maxPrice,
        attributes: Object.keys(attributes).length ? attributes : Prisma.DbNull,
        moveInBy,
        note,
        searchLabel,
        originalSearchLabel: existing.originalSearchLabel ?? existing.searchLabel,
        ...(dto.complete ? { refinedAt: new Date() } : {}),
      },
      include: { city: true, area: true },
    });

    if (row.savedSearchId) {
      // areaIds/bedroomOptions are plain arrays, never undefined, so they never need nullable()'s
      // undefined->null coercion — and Prisma's array-field update type doesn't accept `null`
      // anyway (an array column is never nulled, only set to `[]`). Split out and passed through
      // as-is; everything else in alertCriteria's result is a genuinely nullable scalar.
      const { areaIds: nextAreaIds, bedroomOptions: nextBedroomOptions, ...scalarCriteria } = alertCriteria({
        ...criteria,
        areaIds,
        bedroomOptions,
      });
      await this.prisma.savedSearch
        .update({
          where: { id: row.savedSearchId },
          data: { name: searchLabel, areaIds: nextAreaIds, bedroomOptions: nextBedroomOptions, ...nullable(scalarCriteria) },
        })
        .catch((error: unknown) => {
          this.logger.warn(`Requirement ${id} refined but its alert could not follow: ${String(error)}`);
        });
    }

    return this.toDto(row);
  }

  /** The seeker's own edits — Phase 1's `/my-requirements`.
   *
   * Only ever their own row (the `seekerId` in the where clause is the authorisation, not a
   * filter), and only the fields they own at any time. The criteria change only through
   * `refineMine`, and only until someone has acted on them.
   */
  async updateMine(userId: string, id: string, dto: UpdateMyRequirementDto): Promise<RequirementDto> {
    const existing = await this.prisma.requirement.findFirst({ where: { id, seekerId: userId } });
    if (!existing) throw new NotFoundException('Requirement not found');

    const row = await this.prisma.requirement.update({
      where: { id },
      data: {
        note: dto.note ?? undefined,
        moveInBy: dto.moveInBy ? new Date(dto.moveInBy) : undefined,
      },
      include: { city: true, area: true },
    });
    return this.toDto(row);
  }

  /** Renew, from the seeker. Counts 30 days from whichever is later — now, or the current expiry
   * — so renewing early extends rather than silently shortening, the same rule
   * ListingsService.renew follows. Reopens a row that had aged out, since renewing one is
   * unambiguously "still looking". */
  async renewMine(userId: string, id: string): Promise<RequirementDto> {
    const existing = await this.prisma.requirement.findFirst({ where: { id, seekerId: userId } });
    if (!existing) throw new NotFoundException('Requirement not found');

    const from = Math.max(Date.now(), existing.expiresAt.getTime());
    const row = await this.prisma.requirement.update({
      where: { id },
      data: {
        expiresAt: new Date(from + REQUIREMENT_DURATION_DAYS * 24 * 60 * 60 * 1000),
        ...(existing.closedReason === 'expired' ? { status: 'open', closedReason: null } : {}),
        // Let the notifier consider it again: a renewed requirement is fresh demand, and owners
        // who have since listed something in that area have never heard about it.
        ownersNotifiedAt: null,
      },
      include: { city: true, area: true },
    });
    return this.toDto(row);
  }

  /** Withdrawn or found — both close the row, and which one it was is the only measure of
   * whether this feature works at all, so they are not collapsed into one state. */
  async closeMine(userId: string, id: string, reason: 'fulfilled' | 'withdrawn'): Promise<RequirementDto> {
    const existing = await this.prisma.requirement.findFirst({ where: { id, seekerId: userId } });
    if (!existing) throw new NotFoundException('Requirement not found');

    const row = await this.prisma.requirement.update({
      where: { id },
      data: { status: 'closed', closedReason: reason },
      include: { city: true, area: true },
    });
    return this.toDto(row);
  }

  /**
   * Demand matching one owner's own inventory — what the match email links to.
   *
   * Matched on inventory rather than geography, which is the anti-spam rule that matters most:
   * someone who lists PGs in Bengaluru must never hear about a commercial plot in Agra. An owner
   * qualifies for a requirement when they have (or had) a listing in the same city, the same
   * category, and — when the requirement names one — the same area. Their own requirements are
   * excluded, as is anything closed or expired.
   *
   * Carries no seeker identity whatsoever: the contact path is the plan's messaging-first flow,
   * and until that exists an owner replies through us. See
   * docs/plans/property-requirements-demand-side.md.
   */
  async listMatchingOwnerInventory(ownerId: string): Promise<OwnerRequirementMatchDto[]> {
    const inventory = await this.prisma.listing.findMany({
      where: { ownerId },
      select: { cityId: true, areaId: true, category: true },
      distinct: ['cityId', 'areaId', 'category'],
    });
    if (inventory.length === 0) return [];

    const rows = await this.prisma.requirement.findMany({
      where: {
        status: { in: ['open', 'working'] },
        expiresAt: { gt: new Date() },
        seekerId: { not: ownerId },
        OR: inventory.map((item) => ({
          cityId: item.cityId,
          // A requirement naming no area is city-wide, so it matches any of this owner's areas in
          // that city; one naming an area only matches an owner who has inventory there.
          AND: [{ OR: [{ areaId: null }, { areaId: item.areaId }] }, { OR: [{ category: null }, { category: item.category }] }],
        })),
      },
      include: { city: true, area: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const names = await areaNamesFor(this.prisma, rows);
    return rows.map((row) => ({
      id: row.id,
      searchLabel: row.searchLabel,
      cityName: row.city?.name,
      areaName: row.area?.name,
      areaNames: row.areaIds.map((id) => names.get(id)).filter((name): name is string => Boolean(name)),
      category: row.category ?? undefined,
      transactionType: row.transactionType ?? undefined,
      minPrice: row.minPrice ?? undefined,
      maxPrice: row.maxPrice ?? undefined,
      bedrooms: row.bedrooms ?? undefined,
      bedroomOptions: row.bedroomOptions,
      attributes: attributesOf(row),
      note: row.note ?? undefined,
      moveInBy: row.moveInBy?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
