import { Injectable, Logger } from '@nestjs/common';
import type { RequirementDto } from '@bhavano/types';
import type { Area, City, Requirement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';

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
    status: row.status,
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
}
