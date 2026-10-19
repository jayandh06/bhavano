import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CityOverview } from '@prisma/client';
import {
  validateAreaOverviewContent,
  type AdminCityOverviewDetail,
  type AdminCityOverviewRow,
  type AdminCityOverviewsPage,
  type AreaOverviewContent,
  type AreaOverviewStatus,
  type CityOverviewDto,
} from '@bhavano/types/areaOverview';
import { PrismaService } from '../prisma/prisma.service';
import { cleanContent, sameContent, toFaqs } from '../area-overviews/area-overviews.service';

function toDto(row: CityOverview): CityOverviewDto {
  return {
    cityId: row.cityId,
    status: row.status,
    about: row.about,
    gettingAround: row.gettingAround,
    faqs: toFaqs(row.faqs),
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CityOverviewListOptions {
  status?: AreaOverviewStatus | 'none';
  q?: string;
  offset: number;
  limit: number;
}

/** City overviews: the same review rules as area overviews (see AreaOverviewsService), for a city's
 * own landing page. There are only a few dozen cities, so the list is filtered in memory. */
@Injectable()
export class CityOverviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The published overview for the public site, or null. Never returns drafts. */
  async getPublished(cityId: string): Promise<CityOverviewDto | null> {
    const row = await this.prisma.cityOverview.findFirst({ where: { cityId, status: 'published' } });
    return row ? toDto(row) : null;
  }

  async list(options: CityOverviewListOptions): Promise<AdminCityOverviewsPage> {
    const rows = await this.prisma.$queryRaw<
      {
        cityId: string;
        cityName: string;
        activeListings: number;
        status: AreaOverviewStatus | null;
        updatedAt: Date | null;
        reviewedByName: string | null;
      }[]
    >`
      SELECT c.id AS "cityId", c."name" AS "cityName",
             COUNT(l.id) FILTER (WHERE l."status" = 'active' AND l."publishState" = 'live')::int AS "activeListings",
             o."status" AS "status", o."updatedAt" AS "updatedAt", o."reviewedByName" AS "reviewedByName"
      FROM "City" c
      LEFT JOIN "Listing" l ON l."cityId" = c.id
      LEFT JOIN "CityOverview" o ON o."cityId" = c.id
      GROUP BY c.id, c."name", o."status", o."updatedAt", o."reviewedByName"
      HAVING COUNT(l.id) FILTER (WHERE l."status" = 'active' AND l."publishState" = 'live') > 0 OR o."status" IS NOT NULL
      ORDER BY "activeListings" DESC, c."name"`;

    const q = options.q?.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (options.status === 'none' && r.status !== null) return false;
      if (options.status && options.status !== 'none' && r.status !== options.status) return false;
      if (q && !r.cityName.toLowerCase().includes(q)) return false;
      return true;
    });
    const items: AdminCityOverviewRow[] = filtered.slice(options.offset, options.offset + options.limit).map((r) => ({
      ...r,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    }));
    return { items, total: filtered.length };
  }

  async getForAdmin(cityId: string): Promise<AdminCityOverviewDetail> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, include: { overview: true } });
    if (!city) throw new NotFoundException('City not found');
    const activeListings = await this.prisma.listing.count({ where: { cityId, status: 'active', publishState: 'live' } });
    return { cityId, cityName: city.name, activeListings, overview: city.overview ? toDto(city.overview) : null };
  }

  /** Saves the text as a draft. Changing the text of an in-review or published overview sends it
   * back to draft and clears the approval; identical text leaves the status alone. */
  async save(cityId: string, input: AreaOverviewContent, userId: string): Promise<CityOverviewDto> {
    const content = cleanContent(input);
    const problems = validateAreaOverviewContent(content);
    if (problems.length > 0) throw new BadRequestException(problems);
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new NotFoundException('City not found');

    const existing = await this.prisma.cityOverview.findUnique({ where: { cityId } });
    const faqs = content.faqs as unknown as Prisma.InputJsonValue;
    if (!existing) {
      const created = await this.prisma.cityOverview.create({
        data: { cityId, about: content.about, gettingAround: content.gettingAround, faqs, updatedById: userId },
      });
      return toDto(created);
    }
    if (sameContent(content, { about: existing.about, gettingAround: existing.gettingAround, faqs: toFaqs(existing.faqs) })) {
      return toDto(existing);
    }
    const updated = await this.prisma.cityOverview.update({
      where: { cityId },
      data: {
        about: content.about,
        gettingAround: content.gettingAround,
        faqs,
        updatedById: userId,
        status: 'draft',
        reviewedById: null,
        reviewedByName: null,
        reviewedAt: null,
        publishedAt: null,
      },
    });
    return toDto(updated);
  }

  async setStatus(cityId: string, status: AreaOverviewStatus, checklistConfirmed: boolean, userId: string): Promise<CityOverviewDto> {
    const existing = await this.prisma.cityOverview.findUnique({ where: { cityId } });
    if (!existing) throw new NotFoundException('Save the text first');

    if (status === 'draft') {
      const row = await this.prisma.cityOverview.update({
        where: { cityId },
        data: { status: 'draft', reviewedById: null, reviewedByName: null, reviewedAt: null, publishedAt: null },
      });
      return toDto(row);
    }

    const problems = validateAreaOverviewContent({
      about: existing.about,
      gettingAround: existing.gettingAround,
      faqs: toFaqs(existing.faqs),
    });
    if (problems.length > 0) throw new BadRequestException(problems);

    if (status === 'in_review') {
      return toDto(await this.prisma.cityOverview.update({ where: { cityId }, data: { status: 'in_review' } }));
    }

    if (!checklistConfirmed) throw new BadRequestException('Confirm every item of the review checklist before publishing');
    const reviewer = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const now = new Date();
    const row = await this.prisma.cityOverview.update({
      where: { cityId },
      data: { status: 'published', reviewedById: userId, reviewedByName: reviewer?.name ?? 'Admin', reviewedAt: now, publishedAt: now },
    });
    return toDto(row);
  }
}
