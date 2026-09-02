import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ActivityEventDto,
  AdminListingsPage,
  ListingBoostsPage,
  ListingDetailDto,
  ListingOwnerDto,
  LoginEventsPage,
  PageVisitsPage,
  RateLimitSettingsDto,
  UserActivityDto,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { ListLoginsDto, LoginSort } from './dto/list-logins.dto';
import { ListPageVisitsDto, PageVisitSort } from './dto/list-page-visits.dto';
import { ListBoostsDto } from './dto/list-boosts.dto';
import { UpdateRateLimitsDto } from './dto/update-rate-limits.dto';

const APPROVED_MESSAGE = 'Your listing has been reviewed and is live again.';
const ACTIVITY_LIMIT_PER_SOURCE = 50;
const ACTIVITY_TIMELINE_CAP = 100;

/** Same tie-breaker convention as ListingsService's ORDER_BY tables. */
const LOGIN_ORDER_BY: Record<LoginSort, Prisma.LoginEventOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
};

/** "Sort by user" groups a user's sessions together (by `userId`), then newest-first within;
 * "sort by city" likewise. Nulls last so anonymous / un-geolocated rows don't crowd the top. A
 * final `id` key keeps the order total, which the cursor pagination relies on. */
const PAGE_VISIT_ORDER_BY: Record<PageVisitSort, Prisma.VisitOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
  user_asc: [{ userId: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
  user_desc: [{ userId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
  city_asc: [{ ipCity: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
  city_desc: [{ ipCity: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
};

/**
 * The admin page-visits text-filter DSL → a Prisma string clause (see ListPageVisitsDto for the
 * user-facing summary). `undefined` when the filter is blank.
 *
 *   plain / `%x%`  →  contains
 *   `x%`           →  startsWith
 *   `%x`           →  endsWith
 *   `{a, b, c}`    →  in (exact, any of; a lone `{x}` is exact-equals)
 *   leading `!`    →  negates whichever of the above it wraps
 *
 * All matches are case-insensitive. `%`/`{`/`}`/`!` are operators here, not literals — there is
 * no escape, which is fine for an internal analytics view.
 */
function parseTextFilter(raw: string | undefined): Prisma.StringNullableFilter | undefined {
  let value = raw?.trim();
  if (!value) return undefined;

  let negate = false;
  if (value.startsWith('!')) {
    negate = true;
    value = value.slice(1).trim();
    if (!value) return undefined;
  }

  // The comparison operator, without `mode` — `mode` is a sibling of `not`/the operator on the
  // final filter, not something the nested comparison object carries.
  let op: Prisma.NestedStringNullableFilter;

  const inMatch = /^\{(.*)\}$/s.exec(value);
  if (inMatch) {
    const values = inMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (values.length === 0) return undefined;
    op = { in: values };
  } else {
    const startsWith = value.length > 1 && value.endsWith('%') && !value.startsWith('%');
    const endsWith = value.length > 1 && value.startsWith('%') && !value.endsWith('%');
    const body = value.replace(/^%+/, '').replace(/%+$/, '');
    if (!body) return undefined;
    if (startsWith) op = { startsWith: body };
    else if (endsWith) op = { endsWith: body };
    else op = { contains: body };
  }

  // `mode: 'insensitive'` at this level applies to the comparison whether it is negated or not.
  return negate ? { not: op, mode: 'insensitive' } : { ...op, mode: 'insensitive' };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingsService: ListingsService,
    private readonly messagingService: MessagingService,
    private readonly notificationsService: NotificationsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  listListings(query: ListAdminListingsDto): Promise<AdminListingsPage> {
    return this.listingsService.listForAdmin(query);
  }

  setReviewed(id: string, adminReviewed: boolean): Promise<ListingDetailDto> {
    return this.listingsService.setAdminReviewed(id, adminReviewed);
  }

  /** Get-or-create is safe/idempotent here — used by the admin UI to open a listing's
   * moderation thread for ongoing back-and-forth, not just the one-shot flag/approve notes. */
  async getThread(id: string, adminId: string): Promise<{ id: string }> {
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    return { id: thread.id };
  }

  /** The combined soft-delete + notify-owner action: takes the listing offline, posts the
   * discrepancy as the first message of the admin↔owner moderation thread, and emails/texts
   * the owner so they don't have to notice the message on their own. */
  async flagListing(id: string, adminId: string, message: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.flag(id);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, message);

    const owner = await this.getListingOwner(id);
    if (owner) {
      const channel = await this.notificationsService.notifyListingFlagged(owner, listing, message);
      if (channel) {
        await this.prisma.listingNotificationLog.create({
          data: { listingId: id, kind: 'flagged', channel },
        });
      }
    }

    return listing;
  }

  async approveListing(id: string, adminId: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.approve(id);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, APPROVED_MESSAGE);

    const owner = await this.getListingOwner(id);
    if (owner) {
      const channel = await this.notificationsService.notifyListingApproved(owner, listing);
      if (channel) {
        await this.prisma.listingNotificationLog.create({
          data: { listingId: id, kind: 'approved', channel },
        });
      }
    }

    return listing;
  }

  /** Used both internally (flag/approve notifications) and by the admin UI's listing-detail
   * page, which links to /users/:id/activity from here without ownerId ever appearing in the
   * public ListingDetailDto. */
  async getListingOwner(listingId: string): Promise<ListingOwnerDto | null> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { owner: { select: { id: true, name: true, phone: true, email: true } } },
    });
    return listing?.owner ?? null;
  }

  /** Backs the admin filter bars' UserId picker — type-ahead by name/phone/email, resolving
   * to a userId to filter listings/logins by. Empty/whitespace query short-circuits to no
   * results rather than returning an arbitrary page of users. */
  async searchUsers(q: string, limit: number): Promise<ListingOwnerDto[]> {
    const query = q.trim();
    if (!query) return [];

    return this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
  }

  async listRecentLogins(query: ListLoginsDto): Promise<LoginEventsPage> {
    const { cursor, from, to, userId, method, sort, limit } = query;
    const where: Prisma.LoginEventWhereInput = {
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(userId ? { userId } : {}),
      ...(method ? { method } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.loginEvent.findMany({
        where,
        include: { user: { select: { name: true, phone: true, email: true } } },
        orderBy: LOGIN_ORDER_BY[sort ?? 'createdAt_desc'],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.loginEvent.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.user.name,
        userPhone: row.user.phone,
        userEmail: row.user.email,
        method: row.method,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /** Page-visit log for the admin analytics screen — the raw per-session `Visit` rows behind
   * `User.acquisition*`, filterable on every column. `from`/`to` are already offset-adjusted ISO
   * strings (the admin page turns its IST date pickers into `+05:30` bounds), so a plain
   * `new Date()` here lands on the right instant. */
  async listPageVisits(query: ListPageVisitsDto): Promise<PageVisitsPage> {
    const { cursor, from, to, userId, sort, limit } = query;

    const where: Prisma.VisitWhereInput = {
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(userId ? { userId } : {}),
    };

    for (const [field, raw] of [
      ['source', query.source],
      ['medium', query.medium],
      ['ip', query.ip],
      ['landingPath', query.landingPath],
      ['ipCity', query.city],
      ['ipRegion', query.region],
      ['ipCountry', query.country],
    ] as const) {
      const clause = parseTextFilter(raw);
      if (clause) where[field] = clause;
    }

    const [rows, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: { user: { select: { name: true, phone: true, email: true } } },
        orderBy: PAGE_VISIT_ORDER_BY[sort ?? 'createdAt_desc'],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.visit.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
        userName: row.user?.name ?? null,
        userPhone: row.user?.phone ?? null,
        userEmail: row.user?.email ?? null,
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        landingPath: row.landingPath,
        ip: row.ip,
        ipCity: row.ipCity,
        ipRegion: row.ipRegion,
        ipCountry: row.ipCountry,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /** Merges several tables that each already carry a userId-ish field + timestamp (logins,
   * owned listings, sent messages, favourites, viewed listings) into one sorted timeline,
   * rather than duplicating that data into a new unified log table. */
  async getUserActivity(userId: string): Promise<UserActivityDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { city: true } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const [logins, listings, messages, favourites, views, visits] =
      await Promise.all([
        this.prisma.loginEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
        }),
        this.prisma.listing.findMany({
          where: { ownerId: userId },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
          select: { id: true, title: true, createdAt: true, updatedAt: true },
        }),
        this.prisma.message.findMany({
          where: { senderId: userId },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
          select: { id: true, body: true, createdAt: true },
        }),
        this.prisma.favourite.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
          include: { listing: { select: { title: true } } },
        }),
        this.prisma.listingView.findMany({
          where: { viewerKey: `user:${userId}` },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
          include: { listing: { select: { title: true } } },
        }),
        this.prisma.visit.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
        }),
      ]);

    const events: ActivityEventDto[] = [
      ...logins.map((l) => ({
        type: 'login' as const,
        timestamp: l.createdAt.toISOString(),
        summary: `Logged in via ${l.method}`,
        refId: l.id,
      })),
      ...listings.map((l) => ({
        type: 'listing_posted' as const,
        timestamp: l.createdAt.toISOString(),
        summary: `Posted listing "${l.title}"`,
        refId: l.id,
      })),
      ...listings
        .filter((l) => l.updatedAt.getTime() !== l.createdAt.getTime())
        .map((l) => ({
          type: 'listing_updated' as const,
          timestamp: l.updatedAt.toISOString(),
          summary: `Updated listing "${l.title}"`,
          refId: l.id,
        })),
      ...messages.map((m) => ({
        type: 'message_sent' as const,
        timestamp: m.createdAt.toISOString(),
        summary: `Sent a message: "${m.body.slice(0, 60)}"`,
        refId: m.id,
      })),
      ...favourites.map((f) => ({
        type: 'favourite_added' as const,
        timestamp: f.createdAt.toISOString(),
        summary: `Favourited "${f.listing.title}"`,
        refId: f.listingId,
      })),
      ...views.map((v) => ({
        type: 'listing_viewed' as const,
        timestamp: v.createdAt.toISOString(),
        summary: `Viewed "${v.listing.title}"`,
        refId: v.listingId,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, ACTIVITY_TIMELINE_CAP);

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        cityName: user.city?.name ?? null,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        acquisitionSource: user.acquisitionSource,
        acquisitionMedium: user.acquisitionMedium,
        acquisitionCampaign: user.acquisitionCampaign,
      },
      events,
      visits: visits.map((v) => ({
        id: v.id,
        source: v.source,
        medium: v.medium,
        campaign: v.campaign,
        landingPath: v.landingPath,
        ipCity: v.ipCity,
        ipRegion: v.ipRegion,
        ipCountry: v.ipCountry,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  getRateLimitSettings(): Promise<RateLimitSettingsDto> {
    return this.rateLimitService.getSettings();
  }

  updateRateLimitSettings(dto: UpdateRateLimitsDto): Promise<RateLimitSettingsDto> {
    return this.rateLimitService.updateSettings(dto);
  }

  /** Every purchased boost, newest first — lets support see what a listing's owner actually
   * paid for, alongside `revokeBoost` below for the manual-grant/refund-support case. */
  async listBoosts(query: ListBoostsDto): Promise<ListingBoostsPage> {
    const { cursor, limit } = query;

    const [rows, total] = await Promise.all([
      this.prisma.listingBoost.findMany({
        include: { listing: { include: { owner: { select: { name: true } } } }, payment: true },
        orderBy: { boostedFrom: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.listingBoost.count(),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((row) => ({
        id: row.id,
        listingId: row.listingId,
        listingTitle: row.listing.title,
        ownerName: row.listing.owner.name,
        boostedFrom: row.boostedFrom.toISOString(),
        boostedUntil: row.boostedUntil.toISOString(),
        amount: row.payment.amount,
        currency: row.payment.currency,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /** Manual override for support cases (e.g. a payment that should still get the boost, or a
   * refund) — just clears the denormalized fields the browse query actually reads; the
   * ListingBoost/Payment audit rows are left untouched. */
  async revokeBoost(listingId: string): Promise<void> {
    await this.prisma.listing.update({ where: { id: listingId }, data: { boostedUntil: null, boostRank: null } });
  }
}
