import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  POST_FEEDBACK_DIFFICULTIES,
  POST_FEEDBACK_MAX_SUGGESTION,
  type AdminPostFeedbackPage,
  type AdminPostFeedbackRowDto,
  type PostFeedbackDifficulty,
  type PostFeedbackDto,
  type PostFeedbackSource,
} from '@bhavano/types/postFeedback';
import { PrismaService } from '../prisma/prisma.service';
import { ListPostFeedbackDto } from './dto/list-post-feedback.dto';
import { SavePostFeedbackDto } from './dto/save-post-feedback.dto';

interface FeedbackAnswers {
  rating: number | null;
  difficulties: string[];
  suggestion: string | null;
  canContact: boolean;
}

function knownDifficulties(values: string[]): PostFeedbackDifficulty[] {
  return values.filter((d): d is PostFeedbackDifficulty => (POST_FEEDBACK_DIFFICULTIES as readonly string[]).includes(d));
}

function toDto(listingId: string, row: FeedbackAnswers): PostFeedbackDto {
  return {
    listingId,
    rating: row.rating,
    difficulties: knownDifficulties(row.difficulties),
    suggestion: row.suggestion,
    canContact: row.canContact,
  };
}

/** The platform a client reports ("web", "app"), from the body or the `x-client` header; anything else is stored as unknown. */
export function normalizePlatform(...candidates: (string | undefined)[]): string | null {
  for (const c of candidates) {
    const v = c?.trim().toLowerCase();
    if (v === 'web' || v === 'app') return v;
  }
  return null;
}

/** Counts for the admin screen's header cards, over every row that matched the filters. */
export function summarize(rows: FeedbackAnswers[]): AdminPostFeedbackPage['summary'] {
  const ratingCounts = [0, 0, 0, 0, 0];
  let sum = 0;
  let rated = 0;
  const tally = new Map<PostFeedbackDifficulty, number>();
  for (const r of rows) {
    if (r.rating && r.rating >= 1 && r.rating <= 5) {
      ratingCounts[r.rating - 1] += 1;
      sum += r.rating;
      rated += 1;
    }
    for (const d of knownDifficulties(r.difficulties)) tally.set(d, (tally.get(d) ?? 0) + 1);
  }
  return {
    answered: rows.length,
    averageRating: rated > 0 ? Math.round((sum / rated) * 100) / 100 : null,
    ratingCounts,
    difficultyCounts: [...tally.entries()].map(([difficulty, count]) => ({ difficulty, count })).sort((a, b) => b.count - a.count),
    withSuggestion: rows.filter((r) => !!r.suggestion).length,
    canContact: rows.filter((r) => r.canContact).length,
  };
}

@Injectable()
export class PostFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /** The listing, only if `userId` owns it. A missing listing and someone else's answer differently (404 / 403): the id comes from the
   * owner's own screens, so there is nothing worth hiding. */
  private async ownedListing(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true, category: true, transactionType: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.ownerId !== userId) throw new ForbiddenException('Not your listing');
    return listing;
  }

  async getMine(userId: string, listingId: string): Promise<PostFeedbackDto | null> {
    await this.ownedListing(userId, listingId);
    const row = await this.prisma.postFeedback.findUnique({ where: { listingId } });
    return row ? toDto(listingId, row) : null;
  }

  /** Creates or updates the one row for this listing. A field left out is left as it was, so a star tap can be saved alone and the rest
   * added later. The source, platform and app version are those of the first save. */
  async save(userId: string, dto: SavePostFeedbackDto, clientHeader?: string): Promise<PostFeedbackDto> {
    const listing = await this.ownedListing(userId, dto.listingId);
    const suggestion = dto.suggestion !== undefined ? dto.suggestion.trim().slice(0, POST_FEEDBACK_MAX_SUGGESTION) || null : undefined;
    const difficulties = dto.difficulties ? [...new Set(dto.difficulties)] : undefined;

    const update: Prisma.PostFeedbackUpdateInput = {
      ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
      ...(difficulties ? { difficulties } : {}),
      ...(suggestion !== undefined ? { suggestion } : {}),
      ...(dto.canContact !== undefined ? { canContact: dto.canContact } : {}),
    };
    const row = await this.prisma.postFeedback.upsert({
      where: { listingId: listing.id },
      create: {
        listingId: listing.id,
        userId,
        rating: dto.rating ?? null,
        difficulties: difficulties ?? [],
        suggestion: suggestion ?? null,
        canContact: dto.canContact ?? false,
        source: dto.source ?? 'web_link',
        platform: normalizePlatform(dto.platform, clientHeader),
        appVersion: dto.appVersion?.trim() || null,
        category: listing.category,
        transactionType: listing.transactionType,
      },
      update,
    });
    return toDto(listing.id, row);
  }

  private where(query: ListPostFeedbackDto): Prisma.PostFeedbackWhereInput {
    const { from, to, rating, band, difficulty, source, category, platform, hasText, canContact, listingId, userId } = query;
    return {
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(rating ? { rating } : band === 'low' ? { rating: { gte: 1, lte: 2 } } : {}),
      ...(difficulty ? { difficulties: { has: difficulty } } : {}),
      ...(source ? { source } : {}),
      ...(category ? { category } : {}),
      ...(platform ? { platform } : {}),
      ...(hasText ? { suggestion: { not: null } } : {}),
      ...(canContact ? { canContact: true } : {}),
      ...(listingId ? { listingId } : {}),
      ...(userId ? { userId } : {}),
    };
  }

  async listForAdmin(query: ListPostFeedbackDto): Promise<AdminPostFeedbackPage> {
    const where = this.where(query);
    const [rows, total, all] = await Promise.all([
      this.prisma.postFeedback.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.offset ?? 0,
        take: query.limit,
        include: {
          listing: { select: { title: true } },
          user: { select: { name: true, phone: true, email: true } },
        },
      }),
      this.prisma.postFeedback.count({ where }),
      // Every matching row but only the columns the summary needs: the table has one row per answered listing.
      this.prisma.postFeedback.findMany({ where, select: { rating: true, difficulties: true, suggestion: true, canContact: true } }),
    ]);

    const items: AdminPostFeedbackRowDto[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      rating: r.rating,
      difficulties: knownDifficulties(r.difficulties),
      suggestion: r.suggestion,
      canContact: r.canContact,
      source: r.source as PostFeedbackSource,
      platform: r.platform,
      appVersion: r.appVersion,
      category: r.category,
      transactionType: r.transactionType,
      listingId: r.listingId,
      listingTitle: r.listing.title,
      userId: r.userId,
      userName: r.user.name,
      userPhone: r.user.phone,
      userEmail: r.user.email,
    }));

    return { items, total, summary: summarize(all) };
  }
}
