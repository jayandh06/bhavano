import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AreaOverview } from '@prisma/client';
import {
  validateAreaOverviewContent,
  type AdminAreaOverviewDetail,
  type AdminAreaOverviewRow,
  type AdminAreaOverviewsPage,
  type AreaFaq,
  type AreaOverviewContent,
  type AreaOverviewDto,
  type AreaOverviewStatus,
} from '@bhavano/types/areaOverview';
import { PrismaService } from '../prisma/prisma.service';

function toFaqs(value: Prisma.JsonValue): AreaFaq[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item && typeof item === 'object' && 'question' in item && 'answer' in item) {
      const { question, answer } = item as { question: unknown; answer: unknown };
      if (typeof question === 'string' && typeof answer === 'string') return [{ question, answer }];
    }
    return [];
  });
}

function toDto(row: AreaOverview): AreaOverviewDto {
  return {
    areaId: row.areaId,
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

const clean = (items: string[]) => items.map((t) => t.trim()).filter(Boolean);

export function cleanContent(content: AreaOverviewContent): AreaOverviewContent {
  return {
    about: clean(content.about),
    gettingAround: clean(content.gettingAround),
    faqs: content.faqs
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question || f.answer),
  };
}

export function sameContent(a: AreaOverviewContent, b: AreaOverviewContent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

@Injectable()
export class AreaOverviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The published overview for the public site, or null. Never returns drafts. */
  async getPublished(areaId: string): Promise<AreaOverviewDto | null> {
    const row = await this.prisma.areaOverview.findFirst({ where: { areaId, status: 'published' } });
    return row ? toDto(row) : null;
  }

  /** Every area that has active listings or already has an overview, busiest first, so reviewers
   * start where the traffic is. `status` of "none" means areas with no overview yet. Areas are
   * counted in one query and filtered here: there are a few thousand at most. */
  async list(options: { status?: AreaOverviewStatus | 'none'; q?: string; offset: number; limit: number }): Promise<AdminAreaOverviewsPage> {
    const rows = await this.prisma.$queryRaw<
      {
        areaId: string;
        cityName: string;
        areaName: string;
        activeListings: number;
        status: AreaOverviewStatus | null;
        updatedAt: Date | null;
        reviewedByName: string | null;
      }[]
    >`
      SELECT a.id AS "areaId", c."name" AS "cityName", a."name" AS "areaName",
             COUNT(l.id) FILTER (WHERE l."status" = 'active' AND l."publishState" = 'live')::int AS "activeListings",
             o."status" AS "status", o."updatedAt" AS "updatedAt", o."reviewedByName" AS "reviewedByName"
      FROM "Area" a
      JOIN "City" c ON c.id = a."cityId"
      LEFT JOIN "Listing" l ON l."areaId" = a.id
      LEFT JOIN "AreaOverview" o ON o."areaId" = a.id
      GROUP BY a.id, c."name", a."name", o."status", o."updatedAt", o."reviewedByName"
      HAVING COUNT(l.id) FILTER (WHERE l."status" = 'active' AND l."publishState" = 'live') > 0 OR o."status" IS NOT NULL
      ORDER BY "activeListings" DESC, c."name", a."name"`;

    const q = options.q?.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (options.status === 'none' && r.status !== null) return false;
      if (options.status && options.status !== 'none' && r.status !== options.status) return false;
      if (q && !`${r.areaName} ${r.cityName}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const items: AdminAreaOverviewRow[] = filtered.slice(options.offset, options.offset + options.limit).map((r) => ({
      ...r,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    }));
    return { items, total: filtered.length };
  }

  async getForAdmin(areaId: string): Promise<AdminAreaOverviewDetail> {
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      include: { city: true, overview: true },
    });
    if (!area) throw new NotFoundException('Area not found');
    const activeListings = await this.prisma.listing.count({
      where: { areaId, status: 'active', publishState: 'live' },
    });
    return {
      areaId,
      cityName: area.city.name,
      areaName: area.name,
      activeListings,
      overview: area.overview ? toDto(area.overview) : null,
    };
  }

  /** Saves the text as a draft. Changing the text of an in-review or published overview sends it
   * back to draft and clears the approval, so approved wording cannot change without another
   * review; saving identical text leaves the status alone. */
  async save(areaId: string, input: AreaOverviewContent, userId: string): Promise<AreaOverviewDto> {
    const content = cleanContent(input);
    const problems = validateAreaOverviewContent(content);
    if (problems.length > 0) throw new BadRequestException(problems);
    await this.requireArea(areaId);

    const existing = await this.prisma.areaOverview.findUnique({ where: { areaId } });
    const faqs = content.faqs as unknown as Prisma.InputJsonValue;
    if (!existing) {
      const created = await this.prisma.areaOverview.create({
        data: { areaId, about: content.about, gettingAround: content.gettingAround, faqs, updatedById: userId },
      });
      return toDto(created);
    }

    const unchanged =
      sameContent(content, { about: existing.about, gettingAround: existing.gettingAround, faqs: toFaqs(existing.faqs) });
    if (unchanged) return toDto(existing);

    const updated = await this.prisma.areaOverview.update({
      where: { areaId },
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

  /** draft → in_review → published, and back to draft to unpublish. Publishing needs the reviewer's
   * checklist confirmation and records who approved it and when. */
  async setStatus(
    areaId: string,
    status: AreaOverviewStatus,
    checklistConfirmed: boolean,
    userId: string,
  ): Promise<AreaOverviewDto> {
    const existing = await this.prisma.areaOverview.findUnique({ where: { areaId } });
    if (!existing) throw new NotFoundException('Save the text first');

    if (status === 'draft') {
      const row = await this.prisma.areaOverview.update({
        where: { areaId },
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
      const row = await this.prisma.areaOverview.update({ where: { areaId }, data: { status: 'in_review' } });
      return toDto(row);
    }

    if (!checklistConfirmed) throw new BadRequestException('Confirm every item of the review checklist before publishing');
    const reviewer = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const now = new Date();
    const row = await this.prisma.areaOverview.update({
      where: { areaId },
      data: {
        status: 'published',
        reviewedById: userId,
        reviewedByName: reviewer?.name ?? 'Admin',
        reviewedAt: now,
        publishedAt: now,
      },
    });
    return toDto(row);
  }

  private async requireArea(areaId: string): Promise<void> {
    const area = await this.prisma.area.findUnique({ where: { id: areaId }, select: { id: true } });
    if (!area) throw new NotFoundException('Area not found');
  }
}
