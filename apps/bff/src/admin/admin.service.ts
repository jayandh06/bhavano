import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ActivityEventDto,
  AdminConversationsPage,
  AdminDiscountCodesPage,
  AdminListingsPage,
  AdminUpdateListingInput,
  AdminUsersPage,
  ContactRevealSettingsDto,
  DeviceType,
  DiscountCodeDto,
  ListingBoostsPage,
  ListingDetailDto,
  ListingEditLogPage,
  ListingEngagementPage,
  ListingOwnerDto,
  ListingStatus,
  LoginEventsPage,
  LoginMethod,
  MessageDto,
  PageVisitSessionLogin,
  PageVisitsPage,
  RateLimitSettingsDto,
  SendPostedNotificationResponseDto,
  SendPostedNotificationResultDto,
  SendWelcomeResponseDto,
  SendWelcomeResultDto,
  SessionTrailDto,
  UserActivityDto,
  WelcomeChannel,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import { BoostPricingSettingsService } from '../plans/boost-pricing-settings.service';
import { InstantAlertsPricingSettingsService } from '../plans/instant-alerts-pricing-settings.service';
import { SubscriptionPlanSettingsService } from '../plans/subscription-plan-settings.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { ListLoginsDto, LoginSort } from './dto/list-logins.dto';
import { ListPageVisitsDto, PageVisitSort } from './dto/list-page-visits.dto';
import { ListUsersDto, UserSort } from './dto/list-users.dto';
import { ListBoostsDto } from './dto/list-boosts.dto';
import { ListDiscountCodesDto } from './dto/list-discount-codes.dto';
import { CreateDiscountCodeDto } from './dto/create-discount-code.dto';
import { UpdateRateLimitsDto } from './dto/update-rate-limits.dto';
import { UpdateContactRevealSettingsDto } from './dto/update-contact-reveal-settings.dto';
import { UpdateBoostPricingDto } from './dto/update-boost-pricing.dto';
import { UpdateInstantAlertsPricingDto } from './dto/update-instant-alerts-pricing.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { CAMPAIGN_NAMES, AD_GROUP_NAMES } from '../ads/campaign-names';

const APPROVED_MESSAGE = 'Your listing has been reviewed and is live again.';
const ACTIVITY_LIMIT_PER_SOURCE = 50;
const ACTIVITY_TIMELINE_CAP = 100;
const SESSION_TRAIL_CAP = 1000;

/** Same tie-breaker convention as ListingsService's ORDER_BY tables. */
const LOGIN_ORDER_BY: Record<LoginSort, Prisma.LoginEventOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
};

/** Every entry keeps `createdAt desc` then `id asc` as tiebreakers, so a column full of nulls or
 * repeated values still paginates deterministically instead of shuffling rows between pages.
 * Nulls sort last in both directions on purpose — an empty cell is never the most interesting
 * row to lead with, whichever way the admin is sorting. */
function visitOrderBy(
  field: Prisma.VisitOrderByWithRelationInput,
): Prisma.VisitOrderByWithRelationInput[] {
  return [field, { createdAt: 'desc' }, { id: 'asc' }];
}

const nullsLast = (direction: 'asc' | 'desc') => ({ sort: direction, nulls: 'last' }) as const;

const PAGE_VISIT_ORDER_BY: Record<PageVisitSort, Prisma.VisitOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
  user_asc: visitOrderBy({ userId: nullsLast('asc') }),
  user_desc: visitOrderBy({ userId: nullsLast('desc') }),
  city_asc: visitOrderBy({ ipCity: nullsLast('asc') }),
  city_desc: visitOrderBy({ ipCity: nullsLast('desc') }),
  deviceType_asc: visitOrderBy({ deviceType: nullsLast('asc') }),
  deviceType_desc: visitOrderBy({ deviceType: nullsLast('desc') }),
  source_asc: visitOrderBy({ source: nullsLast('asc') }),
  source_desc: visitOrderBy({ source: nullsLast('desc') }),
  medium_asc: visitOrderBy({ medium: nullsLast('asc') }),
  medium_desc: visitOrderBy({ medium: nullsLast('desc') }),
  campaign_asc: visitOrderBy({ campaign: nullsLast('asc') }),
  campaign_desc: visitOrderBy({ campaign: nullsLast('desc') }),
  campaignId_asc: visitOrderBy({ campaignId: nullsLast('asc') }),
  campaignId_desc: visitOrderBy({ campaignId: nullsLast('desc') }),
  adGroupId_asc: visitOrderBy({ adGroupId: nullsLast('asc') }),
  adGroupId_desc: visitOrderBy({ adGroupId: nullsLast('desc') }),
  landingPath_asc: visitOrderBy({ landingPath: nullsLast('asc') }),
  landingPath_desc: visitOrderBy({ landingPath: nullsLast('desc') }),
  ip_asc: visitOrderBy({ ip: nullsLast('asc') }),
  ip_desc: visitOrderBy({ ip: nullsLast('desc') }),
  region_asc: visitOrderBy({ ipRegion: nullsLast('asc') }),
  region_desc: visitOrderBy({ ipRegion: nullsLast('desc') }),
  country_asc: visitOrderBy({ ipCountry: nullsLast('asc') }),
  country_desc: visitOrderBy({ ipCountry: nullsLast('desc') }),
};

const USER_ORDER_BY: Record<UserSort, Prisma.UserOrderByWithRelationInput[]> = {
  createdAt_desc: [{ createdAt: 'desc' }, { id: 'asc' }],
  createdAt_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
  name_asc: [{ name: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
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

// Same literal as ListingsService/OutreachService's own BULK_IMPORT_OWNER_PHONE and
// seedBulkImportOwner.ts — the placeholder account bulk-imported listings are posted under
// until claimed. Never a real recipient for "your ad is live".
const BULK_IMPORT_OWNER_PHONE = '9000000002';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingsService: ListingsService,
    private readonly messagingService: MessagingService,
    private readonly notificationsService: NotificationsService,
    private readonly rateLimitService: RateLimitService,
    private readonly contactRevealService: ContactRevealService,
    private readonly boostPricingSettingsService: BoostPricingSettingsService,
    private readonly subscriptionPlanSettingsService: SubscriptionPlanSettingsService,
    private readonly instantAlertsPricingSettingsService: InstantAlertsPricingSettingsService,
    private readonly accountDeletion: AccountDeletionService,
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

  listListingEngagement(
    listingId: string,
    offset: number,
    limit: number,
  ): Promise<ListingEngagementPage> {
    return this.listingsService.listEngagement(listingId, offset, limit);
  }

  listListingEditHistory(
    listingId: string,
    offset: number,
    limit: number,
  ): Promise<ListingEditLogPage> {
    return this.listingsService.listEditHistory(listingId, offset, limit);
  }

  listListingConversations(
    listingId: string,
    offset: number,
    limit: number,
  ): Promise<AdminConversationsPage> {
    return this.messagingService.listConversationsForListingAsAdmin(
      listingId,
      offset,
      limit,
    );
  }

  getListingConversationMessages(
    listingId: string,
    conversationId: string,
  ): Promise<MessageDto[]> {
    return this.messagingService.getMessagesAsAdmin(listingId, conversationId);
  }

  /** The combined soft-delete + notify-owner action: takes the listing offline, posts the
   * discrepancy as the first message of the admin↔owner moderation thread, and emails/texts
   * the owner so they don't have to notice the message on their own. */
  async flagListing(id: string, adminId: string, message: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.flag(id, adminId);
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

  /** Permanent hard-delete with full asset cleanup — see ListingsService.deleteCompletely. No
   * owner notification: this is for spam/junk/duplicates where "flag & message" doesn't apply.
   * `adminId` is accepted for call-site symmetry with the other moderation actions; the audit
   * line is emitted by ListingsService. */
  async deleteListing(id: string, _adminId: string): Promise<void> {
    await this.listingsService.deleteCompletely(id);
  }

  /** Permanent removal of a user: hard-deletes every listing they own (with R2 asset cleanup),
   * then anonymises the account and drops its saved searches (via AccountDeletionService — the
   * same code path as a self-serve deletion). The `User` row itself is retained, scrubbed of all
   * PII with `deletedAt` set, because Payment / Conversation / UserSubscription rows reference it
   * with a non-nullable, no-cascade FK — a literal row drop would destroy financial and audit
   * history. Refuses to delete an admin account. */
  async deleteUser(userId: string, _adminId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be deleted from here');
    }
    if (user.deletedAt) return; // already anonymised — deleting twice is not an error

    const listings = await this.prisma.listing.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    for (const { id } of listings) {
      await this.listingsService.deleteCompletely(id);
    }

    await this.accountDeletion.deleteOwnAccount(userId);
  }

  async approveListing(id: string, adminId: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.approve(id, adminId);
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

  /** Admin override of a listing's status (active/sold/rented/deactivated) — see
   * ListingsService.setStatusAsAdmin's doc comment for why this exists. Same transparency
   * principle as flag/approve above: never silent, always a message in the moderation thread the
   * owner already sees. No push/SMS/WhatsApp notification here (unlike flag/approve) — this is a
   * support/correction action, not something that needs to interrupt the owner. */
  async setListingStatus(id: string, status: ListingStatus, adminId: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.setStatusAsAdmin(id, status, adminId);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, `Status changed to "${status}" by an admin.`);
    return listing;
  }

  /** Same "never silent" principle as flag/approve/setListingStatus above — the owner sees a
   * message in the moderation thread whenever an admin edits their listing's content, even
   * though (unlike a status change) there's no separate notification for this. What exactly
   * changed is visible in ListingEditLog for anyone who needs the precise diff. */
  async updateListing(id: string, dto: AdminUpdateListingInput, adminId: string): Promise<ListingDetailDto> {
    const listing = await this.listingsService.updateAsAdmin(id, dto, adminId);
    const thread = await this.messagingService.getOrCreateModerationThread(id, adminId);
    await this.messagingService.sendMessage(thread.id, adminId, "This listing's details were updated by an admin.");
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
    const { offset, from, to, userId, method, sort, limit } = query;
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
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.loginEvent.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.user.name,
        userPhone: row.user.phone,
        userEmail: row.user.email,
        method: row.method,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }

  /** Page-visit log for the admin analytics screen — the raw per-session `Visit` rows behind
   * `User.acquisition*`, filterable on every column. `from`/`to` are already offset-adjusted ISO
   * strings (the admin page turns its IST date pickers into `+05:30` bounds), so a plain
   * `new Date()` here lands on the right instant. */
  async listPageVisits(query: ListPageVisitsDto): Promise<PageVisitsPage> {
    const { offset, from, to, userId, identity, deviceType, traffic, sort, limit } = query;

    const where: Prisma.VisitWhereInput = {
      // `humans` is `isBot: false`, not "not true" — a null (unclassified, i.e. every row from
      // before the column existed, ~99.85% of which is crawler traffic) must not pass as human.
      ...(traffic === 'humans'
        ? { isBot: false }
        : // Stronger than `humans`, and not a User-Agent claim: a JS engine actually ran.
          traffic === 'js_confirmed'
          ? { jsConfirmedAt: { not: null } }
          : traffic === 'bots'
            ? { isBot: true }
            : traffic === 'unclassified'
              ? { isBot: null }
              : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(identity === 'anonymous'
        ? { userId: null }
        : identity === 'logged_in'
          ? { userId: { not: null } }
          : userId
            ? { userId }
            : {}),
      ...(deviceType ? { deviceType } : {}),
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

    // The average below honours the date range and the crawler filter, and nothing else — see
    // `PageVisitsPage.avgPageViewsPerSession`'s doc comment. Joining Visit to PageView is what
    // makes the crawler part possible at all (PageView itself carries no isBot), and it has to:
    // crawlers are one page view per session by construction, so including them pins the average
    // at ~1.0 and makes the headline number on this screen meaningless.
    const [avgRow] = await this.prisma.$queryRaw<{ views: number; sessions: number }[]>`
      SELECT COUNT(pv.id)::int AS views, COUNT(DISTINCT v."sessionId")::int AS sessions
      FROM "Visit" v
      LEFT JOIN "PageView" pv ON pv."sessionId" = v."sessionId"
      WHERE (${from}::timestamptz IS NULL OR v."createdAt" >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR v."createdAt" <= ${to}::timestamptz)
        AND (${traffic ?? null}::text IS NULL
             OR (${traffic}::text = 'any')
             OR (${traffic}::text = 'humans' AND v."isBot" = false)
             OR (${traffic}::text = 'js_confirmed' AND v."jsConfirmedAt" IS NOT NULL)
             OR (${traffic}::text = 'bots' AND v."isBot" = true)
             OR (${traffic}::text = 'unclassified' AND v."isBot" IS NULL))`;

    const [rows, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: { user: { select: { name: true, phone: true, email: true } } },
        orderBy: PAGE_VISIT_ORDER_BY[sort ?? 'createdAt_desc'],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.visit.count({ where }),
    ]);

    const sessionIds = rows.map((r) => r.sessionId);

    const pageViewCounts = rows.length
      ? await this.prisma.pageView.groupBy({
          by: ['sessionId'],
          where: { sessionId: { in: sessionIds } },
          _count: { _all: true },
        })
      : [];
    const pageViewCountBySessionId = new Map(pageViewCounts.map((c) => [c.sessionId, c._count._all]));

    // Every account that logged in during each of these sessions — `Visit.userId` alone can only
    // name whoever logged in first, which silently hid real signups (see PageVisitDto's
    // `sessionLogins`). Scoped to the page of rows on screen, like the page-view counts above.
    const logins = rows.length
      ? await this.prisma.loginEvent.findMany({
          where: { sessionId: { in: sessionIds } },
          include: { user: { select: { id: true, name: true, phone: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const loginsBySessionId = new Map<string, PageVisitSessionLogin[]>();
    for (const login of logins) {
      if (!login.sessionId) continue;
      const list = loginsBySessionId.get(login.sessionId) ?? [];
      // One entry per account, not per login — someone logging in three times in a session is
      // one account on this screen, not three.
      if (!list.some((l) => l.userId === login.user.id)) {
        list.push({
          userId: login.user.id,
          name: login.user.name,
          phone: login.user.phone,
          email: login.user.email,
          method: login.method as LoginMethod,
          createdAt: login.createdAt.toISOString(),
        });
      }
      loginsBySessionId.set(login.sessionId, list);
    }

    return {
      items: rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        createdAt: row.createdAt.toISOString(),
        userId: row.userId,
        userName: row.user?.name ?? null,
        userPhone: row.user?.phone ?? null,
        userEmail: row.user?.email ?? null,
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        campaignId: row.campaignId ?? undefined,
        adGroupId: row.adGroupId ?? undefined,
        campaignName: row.campaignId ? CAMPAIGN_NAMES[row.campaignId] : undefined,
        adGroupName: row.adGroupId ? AD_GROUP_NAMES[row.adGroupId] : undefined,
        landingPath: row.landingPath,
        ip: row.ip,
        ipCity: row.ipCity,
        ipRegion: row.ipRegion,
        ipCountry: row.ipCountry,
        deviceType: row.deviceType as DeviceType | null,
        jsConfirmedAt: row.jsConfirmedAt?.toISOString() ?? null,
        pageViewCount: pageViewCountBySessionId.get(row.sessionId) ?? 0,
        sessionLogins: loginsBySessionId.get(row.sessionId) ?? [],
      })),
      total,
      avgPageViewsPerSession: avgRow && avgRow.sessions > 0 ? avgRow.views / avgRow.sessions : null,
    };
  }

  /** A single session's full page-view trail plus its Visit summary, for the admin page-visits
   * screen's drill-down. */
  async getSessionTrail(sessionId: string): Promise<SessionTrailDto> {
    const [visit, pageViews, pageViewCount, sessionLoginRows] = await Promise.all([
      this.prisma.visit.findUnique({
        where: { sessionId },
        include: { user: { select: { name: true, phone: true, email: true } } },
      }),
      // Capped rather than unbounded — a long-lived tab left open for days is the only realistic
      // way a single session racks up more than this many rows.
      this.prisma.pageView.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: SESSION_TRAIL_CAP }),
      this.prisma.pageView.count({ where: { sessionId } }),
      this.prisma.loginEvent.findMany({
        where: { sessionId },
        include: { user: { select: { id: true, name: true, phone: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!visit) throw new NotFoundException('No visit found for this session');

    // Same de-duplication as listPageVisits — one entry per account, not per login.
    const sessionLogins: PageVisitSessionLogin[] = [];
    for (const login of sessionLoginRows) {
      if (sessionLogins.some((l) => l.userId === login.user.id)) continue;
      sessionLogins.push({
        userId: login.user.id,
        name: login.user.name,
        phone: login.user.phone,
        email: login.user.email,
        method: login.method as LoginMethod,
        createdAt: login.createdAt.toISOString(),
      });
    }

    return {
      visit: {
        id: visit.id,
        sessionId: visit.sessionId,
        createdAt: visit.createdAt.toISOString(),
        userId: visit.userId,
        userName: visit.user?.name ?? null,
        userPhone: visit.user?.phone ?? null,
        userEmail: visit.user?.email ?? null,
        source: visit.source,
        medium: visit.medium,
        campaign: visit.campaign,
        campaignId: visit.campaignId ?? undefined,
        adGroupId: visit.adGroupId ?? undefined,
        campaignName: visit.campaignId ? CAMPAIGN_NAMES[visit.campaignId] : undefined,
        adGroupName: visit.adGroupId ? AD_GROUP_NAMES[visit.adGroupId] : undefined,
        landingPath: visit.landingPath,
        ip: visit.ip,
        ipCity: visit.ipCity,
        ipRegion: visit.ipRegion,
        ipCountry: visit.ipCountry,
        deviceType: visit.deviceType as DeviceType | null,
        jsConfirmedAt: visit.jsConfirmedAt?.toISOString() ?? null,
        pageViewCount,
        sessionLogins,
      },
      pageViews: pageViews.map((p) => ({ path: p.path, createdAt: p.createdAt.toISOString() })),
    };
  }

  /** The admin users list — every user, filterable/sortable, with a derived notification status.
   * `welcomed`/`welcomedChannel`/`welcomedAt` come from the most recent `UserNotificationLog`
   * row with `kind: 'welcome'`, not from `User.welcomedAt` — that flag is set the moment a send
   * is *attempted*, regardless of whether it actually succeeded (see
   * docs/plans/whatsapp-welcome-mobile-signups.md's backfill, which found 34 users with the flag
   * set and zero real log rows). */
  async listUsers(query: ListUsersDto): Promise<AdminUsersPage> {
    const { offset, from, to, q, role, welcomed, sort, limit } = query;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(welcomed === 'yes' ? { notificationLogs: { some: { kind: 'welcome' } } } : {}),
      ...(welcomed === 'no' ? { notificationLogs: { none: { kind: 'welcome' } } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          city: true,
          notificationLogs: { where: { kind: 'welcome' }, orderBy: { sentAt: 'desc' }, take: 1 },
        },
        orderBy: USER_ORDER_BY[sort ?? 'createdAt_desc'],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
        cityName: u.city?.name ?? null,
        createdAt: u.createdAt.toISOString(),
        welcomed: u.notificationLogs.length > 0,
        welcomedChannel: u.notificationLogs[0]?.channel ?? null,
        welcomedAt: u.notificationLogs[0]?.sentAt.toISOString() ?? null,
      })),
      total,
    };
  }

  /** Admin-triggered, deliberate (re)send of the welcome notification to one or many users at
   * once — the in-product counterpart to the one-off backfill script this session ran from the
   * terminal to fix the same gap this discovered (see
   * docs/plans/whatsapp-welcome-mobile-signups.md). No gate on `welcomedAt` or an existing
   * `UserNotificationLog` row: the admin is explicitly choosing to send, same trust-the-admin
   * posture as `setListingStatus`'s manual override above. Sequential, not `Promise.all` — this
   * hits an external API (SMTP / MSG91) per user and shouldn't fire them all concurrently. */
  async sendWelcome(userIds: string[], channel: WelcomeChannel): Promise<SendWelcomeResponseDto> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true, name: true, email: true, phone: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const results: SendWelcomeResultDto[] = [];
    for (const userId of userIds) {
      const user = byId.get(userId);
      if (!user) {
        results.push({ userId, success: false, error: 'User not found' });
        continue;
      }

      let sentChannel: WelcomeChannel | null = null;
      if (channel === 'email') {
        if (!user.email) {
          results.push({ userId, success: false, error: 'No email on file' });
          continue;
        }
        sentChannel = await this.notificationsService.sendWelcomeEmail({ name: user.name, email: user.email });
      } else {
        if (!user.phone) {
          results.push({ userId, success: false, error: 'No phone on file' });
          continue;
        }
        sentChannel = await this.notificationsService.sendWelcomeWhatsapp({ name: user.name, phone: user.phone });
      }

      if (!sentChannel) {
        results.push({ userId, success: false, error: 'Send failed' });
        continue;
      }

      await this.prisma.userNotificationLog.create({ data: { userId, kind: 'welcome', channel: sentChannel } });
      results.push({ userId, success: true });
    }

    return {
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /** Admin-triggered (re)send of the "your ad is live" acknowledgement (see
   * docs/plans/post-ad-acknowledgement.md and NotificationsService.notifyListingPosted) for one
   * or many listings at once — the resend path that plan explicitly left out of scope, for
   * listings whose one-shot, fire-and-forget send at creation time never landed (an email/
   * WhatsApp failure, or an owner who had neither on file yet). Unlike sendWelcome above, this
   * DOES gate on an existing ListingNotificationLog('posted') row: the point is "send it for the
   * ones that slipped through", not a deliberate unconditional resend, so an admin can select a
   * mixed batch (some already sent, some not) without double-sending the ones that already went
   * out. Sequential, not `Promise.all` — hits an external API (SMTP / MSG91) per listing. */
  async sendPostedNotification(listingIds: string[]): Promise<SendPostedNotificationResponseDto> {
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: {
        owner: { select: { name: true, email: true, phone: true } },
        city: true,
        area: true,
        notificationLogs: { where: { kind: 'posted' }, take: 1 },
      },
    });
    const byId = new Map(listings.map((l) => [l.id, l]));

    const results: SendPostedNotificationResultDto[] = [];
    for (const listingId of listingIds) {
      const listing = byId.get(listingId);
      if (!listing) {
        results.push({ listingId, success: false, error: 'Listing not found' });
        continue;
      }
      if (listing.notificationLogs.length > 0) {
        results.push({ listingId, success: false, error: 'Already sent' });
        continue;
      }
      if (listing.owner.phone === BULK_IMPORT_OWNER_PHONE) {
        results.push({ listingId, success: false, error: 'Bulk-import placeholder owner — no real recipient' });
        continue;
      }

      const sent = await this.notificationsService.notifyListingPosted(listing.owner, {
        id: listing.id,
        slug: listing.slug,
        category: listing.category,
        transactionType: listing.transactionType,
        cityName: listing.city.name,
        area: listing.area.name,
        title: listing.title,
      });

      if (!sent) {
        results.push({ listingId, success: false, error: 'Owner has no email or phone on file' });
        continue;
      }

      await this.prisma.listingNotificationLog.create({
        data: { listingId, kind: 'posted', channel: sent.channel, providerMessageId: sent.messageId ?? null },
      });
      results.push({ listingId, success: true });
    }

    return {
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /** Merges several tables that each already carry a userId-ish field + timestamp (logins,
   * owned listings, sent messages, favourites, viewed listings) into one sorted timeline,
   * rather than duplicating that data into a new unified log table. */
  async getUserActivity(userId: string): Promise<UserActivityDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { city: true } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const [logins, listings, listingEdits, messages, favourites, views, visits] =
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
          select: { id: true, title: true, createdAt: true },
        }),
        // A real content edit, not "the row got touched" — view/like counters and boost
        // rotation all call prisma.listing.update() too, which bumps updatedAt via Prisma's own
        // @updatedAt regardless of which field actually changed. Comparing updatedAt to
        // createdAt used to flag literally every listing as "updated" the moment it got its
        // first view (routinely the owner's own view, right after posting) — ListingEditLog
        // exists specifically so this can be a precise "did the content actually change" signal.
        this.prisma.listingEditLog.findMany({
          where: { actorId: userId, actorType: 'owner', action: 'updated' },
          orderBy: { createdAt: 'desc' },
          take: ACTIVITY_LIMIT_PER_SOURCE,
          include: { listing: { select: { title: true } } },
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

    const visitPageViewCounts = visits.length
      ? await this.prisma.pageView.groupBy({
          by: ['sessionId'],
          where: { sessionId: { in: visits.map((v) => v.sessionId) } },
          _count: { _all: true },
        })
      : [];
    const visitPageViewCountBySessionId = new Map(visitPageViewCounts.map((c) => [c.sessionId, c._count._all]));

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
      ...listingEdits.map((e) => ({
        type: 'listing_updated' as const,
        timestamp: e.createdAt.toISOString(),
        summary: `Updated listing "${e.listing.title}"`,
        refId: e.listingId,
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
        sessionId: v.sessionId,
        source: v.source,
        medium: v.medium,
        campaign: v.campaign,
        landingPath: v.landingPath,
        ipCity: v.ipCity,
        ipRegion: v.ipRegion,
        ipCountry: v.ipCountry,
        deviceType: v.deviceType as DeviceType | null,
        createdAt: v.createdAt.toISOString(),
        pageViewCount: visitPageViewCountBySessionId.get(v.sessionId) ?? 0,
      })),
    };
  }

  getRateLimitSettings(): Promise<RateLimitSettingsDto> {
    return this.rateLimitService.getSettings();
  }

  updateRateLimitSettings(dto: UpdateRateLimitsDto): Promise<RateLimitSettingsDto> {
    return this.rateLimitService.updateSettings(dto);
  }

  getContactRevealSettings(): Promise<ContactRevealSettingsDto> {
    return this.contactRevealService.getSettings();
  }

  updateContactRevealSettings(dto: UpdateContactRevealSettingsDto): Promise<ContactRevealSettingsDto> {
    return this.contactRevealService.updateSettings(dto);
  }

  getBoostPricingSettings() {
    return this.boostPricingSettingsService.getSettings();
  }

  updateBoostPricingSettings(dto: UpdateBoostPricingDto) {
    return this.boostPricingSettingsService.updateSettings(dto);
  }

  getSubscriptionPlanSettings() {
    return this.subscriptionPlanSettingsService.getSettings();
  }

  updateSubscriptionPlanSettings(dto: UpdateSubscriptionPlanDto) {
    return this.subscriptionPlanSettingsService.updateSettings(dto);
  }

  getInstantAlertsPricingSettings() {
    return this.instantAlertsPricingSettingsService.getSettings();
  }

  updateInstantAlertsPricingSettings(dto: UpdateInstantAlertsPricingDto) {
    return this.instantAlertsPricingSettingsService.updateSettings(dto);
  }

  /** Admin-managed discount codes — see docs/plans/contact-reveal-credits.md. `redemptionCount`
   * is derived from DiscountCodeRedemption (only created once a payment is actually `paid`), not
   * a denormalized counter, same "derive from the log" convention as everything else admin-
   * facing in this file. */
  async listDiscountCodes(query: ListDiscountCodesDto): Promise<AdminDiscountCodesPage> {
    const { offset, limit } = query;

    const [rows, total] = await Promise.all([
      this.prisma.discountCode.findMany({
        include: { _count: { select: { redemptions: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.discountCode.count(),
    ]);

    return {
      items: rows.map((row) => this.toDiscountCodeDto(row)),
      total,
    };
  }

  async createDiscountCode(dto: CreateDiscountCodeDto): Promise<DiscountCodeDto> {
    const row = await this.prisma.discountCode.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        discountPercent: dto.discountPercent,
        maxRedemptions: dto.maxRedemptions,
        maxRedemptionsPerUser: dto.maxRedemptionsPerUser ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: { _count: { select: { redemptions: true } } },
    });
    return this.toDiscountCodeDto(row);
  }

  async setDiscountCodeActive(id: string, active: boolean): Promise<DiscountCodeDto> {
    const row = await this.prisma.discountCode.update({
      where: { id },
      data: { active },
      include: { _count: { select: { redemptions: true } } },
    });
    return this.toDiscountCodeDto(row);
  }

  private toDiscountCodeDto(row: {
    id: string;
    code: string;
    discountPercent: number;
    maxRedemptions: number | null;
    maxRedemptionsPerUser: number;
    expiresAt: Date | null;
    active: boolean;
    createdAt: Date;
    _count: { redemptions: number };
  }): DiscountCodeDto {
    return {
      id: row.id,
      code: row.code,
      discountPercent: row.discountPercent,
      maxRedemptions: row.maxRedemptions,
      maxRedemptionsPerUser: row.maxRedemptionsPerUser,
      redemptionCount: row._count.redemptions,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Every purchased boost, newest first — lets support see what a listing's owner actually
   * paid for, alongside `revokeBoost` below for the manual-grant/refund-support case. */
  async listBoosts(query: ListBoostsDto): Promise<ListingBoostsPage> {
    const { offset, limit } = query;

    const [rows, total] = await Promise.all([
      this.prisma.listingBoost.findMany({
        include: { listing: { include: { owner: { select: { name: true } } } }, payment: true },
        orderBy: [{ boostedFrom: 'desc' }, { id: 'asc' }],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.listingBoost.count(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        listingId: row.listingId,
        listingTitle: row.listing.title,
        ownerName: row.listing.owner.name,
        boostedFrom: row.boostedFrom.toISOString(),
        boostedUntil: row.boostedUntil.toISOString(),
        amount: row.payment.amount,
        currency: row.payment.currency,
      })),
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
