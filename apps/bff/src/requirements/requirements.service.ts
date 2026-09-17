import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { OwnerRequirementMatchDto, RequirementDto } from '@bhavano/types';
import type { Area, City, Requirement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateMyRequirementDto } from './dto/update-my-requirement.dto';

/** Same 30-day life as a listing (DEFAULT_LISTING_DURATION_DAYS in listings.service.ts), and
 * renewable the same way. Requirements have to age out: an owner who wastes a call on someone
 * who moved three months ago stops trusting the queue, which costs more than the lead was
 * worth. */
export const REQUIREMENT_DURATION_DAYS = 30;

function expiryFromNow(): Date {
  return new Date(Date.now() + REQUIREMENT_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

function toDto(row: Requirement & { city: City | null; area: Area | null }): RequirementDto {
  return {
    id: row.id,
    searchLabel: row.searchLabel,
    category: row.category ?? undefined,
    transactionType: row.transactionType ?? undefined,
    cityId: row.cityId ?? undefined,
    cityName: row.city?.name,
    areaId: row.areaId ?? undefined,
    areaName: row.area?.name,
    minPrice: row.minPrice ?? undefined,
    maxPrice: row.maxPrice ?? undefined,
    bedrooms: row.bedrooms ?? undefined,
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
  ) {}

  async create(userId: string, dto: CreateRequirementDto): Promise<RequirementDto> {
    const savedSearchId = await this.tryCreateAlert(userId, dto);

    const requirement = await this.prisma.requirement.create({
      data: {
        seekerId: userId,
        searchLabel: dto.searchLabel,
        category: dto.category,
        transactionType: dto.transactionType,
        cityId: dto.cityId,
        areaId: dto.areaId,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        bedrooms: dto.bedrooms,
        landingPath: dto.landingPath,
        note: dto.note,
        moveInBy: dto.moveInBy ? new Date(dto.moveInBy) : undefined,
        expiresAt: expiryFromNow(),
        savedSearchId,
      },
      include: { city: true, area: true },
    });

    // Best-effort, like every other notification in the app: a failed send must not fail the
    // capture, which is the part that actually matters.
    const seeker = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (seeker) {
      await this.notificationsService
        .notifyRequirementCaptured(seeker, dto.searchLabel, savedSearchId !== null)
        .catch((error: unknown) => {
          this.logger.error(`Requirement ${requirement.id} captured but confirmation failed: ${String(error)}`);
          return null;
        });
    }

    return toDto(requirement);
  }

  /** The alert half. Returns its id, or null when the seeker has no allowance left (or the
   * create failed) — the caller uses that to decide what the confirmation may promise. */
  private async tryCreateAlert(userId: string, dto: CreateRequirementDto): Promise<string | null> {
    try {
      const allowance = await this.savedSearchesService.alertAllowance(userId);
      if (!allowance) return null;

      const saved = await this.savedSearchesService.create(userId, {
        name: dto.searchLabel,
        category: dto.category,
        transactionType: dto.transactionType,
        cityId: dto.cityId,
        areaId: dto.areaId,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        bedrooms: dto.bedrooms,
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
    return rows.map(toDto);
  }

  /** The seeker's own edits — Phase 1's `/my-requirements`.
   *
   * Only ever their own row (the `seekerId` in the where clause is the authorisation, not a
   * filter), and only the fields they own: the criteria stay as captured, because an admin may
   * already have worked the queue against them.
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
    return toDto(row);
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
    return toDto(row);
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
    return toDto(row);
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

    return rows.map((row) => ({
      id: row.id,
      searchLabel: row.searchLabel,
      cityName: row.city?.name,
      areaName: row.area?.name,
      category: row.category ?? undefined,
      transactionType: row.transactionType ?? undefined,
      minPrice: row.minPrice ?? undefined,
      maxPrice: row.maxPrice ?? undefined,
      bedrooms: row.bedrooms ?? undefined,
      note: row.note ?? undefined,
      moveInBy: row.moveInBy?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
