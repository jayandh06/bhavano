import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ActivityEventDto,
  AdminConversationsPage,
  AdminDiscountCodesPage,
  AdminListingsPage,
  AdminPaymentsPage,
  AdminUpdateListingInput,
  AdminRequirementsPage,
  AdminUsersPage,
  ContactRevealSettingsDto,
  DeviceType,
  DiscountCodeDto,
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
  SavedSearchSettingsDto,
  SearchDemandPage,
  SearchDemandRowDto,
  SendWelcomeResultDto,
  SessionTrailDto,
  UserActivityDto,
  WelcomeChannel,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { boostPriceFor, type BoostDurationDays } from '@bhavano/types/boostPricing';
import { ACTIVE_PROMO_CODE, promoPriceFor } from '@bhavano/types/promoCode';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';
import { BoostPricingSettingsService } from '../plans/boost-pricing-settings.service';
import { InstantAlertsPricingSettingsService } from '../plans/instant-alerts-pricing-settings.service';
import { SubscriptionPlanSettingsService } from '../plans/subscription-plan-settings.service';
import { AccountDeletionService } from '../users/account-deletion.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { ListLoginsDto, LoginSort } from './dto/list-logins.dto';
import { ListPageVisitsDto, PageVisitSort } from './dto/list-page-visits.dto';
import { ListRequirementsDto } from './dto/list-requirements.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { UpdateSavedSearchSettingsDto } from './dto/update-saved-search-settings.dto';
import { ListUsersDto, UserSort } from './dto/list-users.dto';
import { AdminPaymentSort, ListPaymentsDto } from './dto/list-payments.dto';
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

function paymentOrderBy(
  field: Prisma.PaymentOrderByWithRelationInput,
): Prisma.PaymentOrderByWithRelationInput[] {
  return [field, { id: 'asc' }];
}

const ADMIN_PAYMENT_ORDER_BY: Record<AdminPaymentSort, Prisma.PaymentOrderByWithRelationInput[]> = {
  createdAt_desc: paymentOrderBy({ createdAt: 'desc' }),
  createdAt_asc: paymentOrderBy({ createdAt: 'asc' }),
  paidAt_desc: paymentOrderBy({ paidAt: nullsLast('desc') }),
  paidAt_asc: paymentOrderBy({ paidAt: nullsLast('asc') }),
  amount_desc: paymentOrderBy({ amount: 'desc' }),
  amount_asc: paymentOrderBy({ amount: 'asc' }),
  status_desc: paymentOrderBy({ status: 'desc' }),
  status_asc: paymentOrderBy({ status: 'asc' }),
  purpose_desc: paymentOrderBy({ purpose: 'desc' }),
  purpose_asc: paymentOrderBy({ purpose: 'asc' }),
  user_desc: paymentOrderBy({ user: { name: nullsLast('desc') } }),
  user_asc: paymentOrderBy({ user: { name: nullsLast('asc') } }),
  // Listing.title is a required column (unlike User.name) — nulls-handling isn't a valid option
  // on it at all, even though the *relation* itself is optional (a non-listing purchase has none).
  listing_desc: paymentOrderBy({ listing: { title: 'desc' } }),
  listing_asc: paymentOrderBy({ listing: { title: 'asc' } }),
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

/** "30 September" in IST — the offer's own deadline, in the timezone every recipient is in.
 * Rendered from the DiscountCode row rather than written into the copy, so extending the offer in
 * the admin screen changes what the next message says. An open-ended code says "while it lasts",
 * which is the only honest thing to say about a date that does not exist. */
function formatOfferEnd(expiresAt: Date | null): string {
  if (!expiresAt) return 'while it lasts';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(expiresAt);
}

/** `ListingNotificationLog.kind` for the Boost/Instant Alerts promotion, alongside 'posted' and
 * the expiry reminder's own kind. */
const BOOST_PROMO_NOTIFICATION_KIND = 'boost_promo';

/** How long the same listing is left alone after a promotion. A second nudge weeks later is fair;
 * two in a week is spam, and an owner who reads it that way stops reading everything else. */
const PROMO_COOLDOWN_DAYS = 14;

/** The duration quoted in the message — the cheaper of the two, as the entry price. The dialog
 * the link opens offers both. */
const PROMO_BOOST_DAYS: BoostDurationDays = 7;

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
    private readonly savedSearchesService: SavedSearchesService,
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

  /**
   * Admin-triggered promotion of Boost and Instant Alerts to the owners of selected live ads —
   * the "Send boost promo" action on the listings dashboard.
   *
   * Unlike `sendPostedNotification` above, this is marketing, so the guard rails are different:
   * that one is a one-shot resend of something owed to the owner, this one is a pitch, and a
   * pitch that arrives twice is worse than one that never arrives.
   *
   *  - **A cooldown, not a once-ever gate.** `PROMO_COOLDOWN_DAYS` since the last promo for the
   *    same listing. A second nudge weeks later is fair; two in a week is spam.
   *  - **Only live ads.** Nothing to boost on an inactive, sold or expired listing, and asking
   *    someone to pay to promote one would be indefensible.
   *  - **Nothing to sell, nothing sent.** An ad already boosted *and* already on Instant Alerts
   *    is skipped — everything the message offers, the owner has bought.
   *  - **No placeholder owners**, same as the posted resend: a bulk-import row has no real
   *    recipient behind it.
   *
   * Prices come from the live admin-editable settings, not the copy, so the figure in the email
   * is the figure at checkout. The 7-day boost is quoted as the entry price; the dialog the link
   * opens offers both durations.
   *
   * Sequential rather than `Promise.all`: one external send (SMTP / WhatsApp) per listing.
   */
  async sendBoostPromotion(listingIds: string[]): Promise<SendPostedNotificationResponseDto> {
    const cooldownStart = new Date(Date.now() - PROMO_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const [listings, boostPrices, alertsPrices, promo] = await Promise.all([
      this.prisma.listing.findMany({
        where: { id: { in: listingIds } },
        include: {
          owner: { select: { name: true, email: true, phone: true } },
          city: true,
          area: true,
          notificationLogs: {
            where: { kind: BOOST_PROMO_NOTIFICATION_KIND, sentAt: { gte: cooldownStart } },
            take: 1,
          },
        },
      }),
      this.boostPricingSettingsService.getSettings(),
      this.instantAlertsPricingSettingsService.getSettings(),
      // The app auto-applies this code at checkout (ACTIVE_PROMO_CODE), so the message has to
      // quote the price that code produces or it would undersell — or worse, overstate. Read from
      // the row, never assumed: no row, inactive or expired means the plain, no-offer wording.
      // Redemption caps are deliberately *not* checked here: maxRedemptionsPerUser is per seller
      // and one shared query cannot answer it for a batch, so the offer is quoted and the checkout
      // is the authority — a seller who has already used it sees full price there, which is the
      // same thing that happens today on the post-ad screen.
      this.prisma.discountCode.findUnique({ where: { code: ACTIVE_PROMO_CODE } }),
    ]);
    const byId = new Map(listings.map((l) => [l.id, l]));
    const now = Date.now();
    const offerPercent =
      promo && promo.active && (promo.expiresAt === null || promo.expiresAt.getTime() > now)
        ? promo.discountPercent
        : undefined;

    const results: SendPostedNotificationResultDto[] = [];
    for (const listingId of listingIds) {
      const listing = byId.get(listingId);
      if (!listing) {
        results.push({ listingId, success: false, error: 'Listing not found' });
        continue;
      }
      if (listing.status !== 'active' || listing.expiresAt.getTime() <= now) {
        results.push({ listingId, success: false, error: 'Not a live listing — nothing to promote' });
        continue;
      }
      if (listing.owner.phone === BULK_IMPORT_OWNER_PHONE) {
        results.push({ listingId, success: false, error: 'Bulk-import placeholder owner — no real recipient' });
        continue;
      }
      if (
        (listing.boostedUntil?.getTime() ?? 0) > now &&
        (listing.instantAlertsUntil?.getTime() ?? 0) > now
      ) {
        results.push({ listingId, success: false, error: 'Already boosted and on Instant Alerts' });
        continue;
      }
      if (listing.notificationLogs.length > 0) {
        results.push({
          listingId,
          success: false,
          error: `Promoted in the last ${PROMO_COOLDOWN_DAYS} days`,
        });
        continue;
      }

      const boostBasePrice = boostPriceFor(listing.category, PROMO_BOOST_DAYS, boostPrices);
      const bundleBasePrice = boostBasePrice + alertsPrices.instantAlertsPrice;
      const channels = await this.notificationsService.notifyBoostPromotion(
        listing.owner,
        {
          id: listing.id,
          title: listing.title,
          cityName: listing.city.name,
          area: listing.area.name,
        },
        {
          // `promoPriceFor` rounds the way PaymentsService.previewBoostPricing does, so the figure
          // in the message is the figure on the screen the buttons open.
          boostPrice: offerPercent ? promoPriceFor(boostBasePrice, offerPercent) : boostBasePrice,
          bundlePrice: offerPercent ? promoPriceFor(bundleBasePrice, offerPercent) : bundleBasePrice,
          boostDays: PROMO_BOOST_DAYS,
          alertsPrice: alertsPrices.instantAlertsPrice,
          ...(offerPercent
            ? {
                offer: {
                  discountPercent: offerPercent,
                  boostBasePrice,
                  bundleBasePrice,
                  endsOn: formatOfferEnd(promo!.expiresAt),
                },
              }
            : {}),
        },
      );

      if (channels.length === 0) {
        results.push({
          listingId,
          success: false,
          // The three causes need three different actions from an admin: chase an email address,
          // fix the WhatsApp template config, or accept there is no way to reach this owner.
          error: listing.owner.email
            ? 'Send failed'
            : listing.owner.phone
              ? 'Owner has no email, and the WhatsApp promo send failed or is unconfigured (MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME/_NAMESPACE)'
              : 'Owner has no email or phone on file',
        });
        continue;
      }

      // One row per channel — an owner with both gets two, which is what the cooldown query then
      // reads ("has anything gone out recently", not "how many"). A single row with a combined
      // channel string would be a new value for every reader of `channel` to learn.
      await this.prisma.listingNotificationLog.createMany({
        data: channels.map(({ channel, messageId }) => ({
          listingId,
          kind: BOOST_PROMO_NOTIFICATION_KIND,
          channel,
          // Null for email, MSG91's request_id for WhatsApp — the key its delivery/read webhook
          // correlates back by, exactly as the posted-notification row stores it.
          providerMessageId: messageId ?? null,
        })),
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

  /** Manual override for support cases (e.g. a payment that should still get the boost, or a
   * refund) — just clears the denormalized fields the browse query actually reads; the
   * ListingBoost/Payment audit rows are left untouched. Surfaced from the Subscriptions screen's
   * per-row action now — the boosts-only listing this used to pair with was folded into that
   * unified feed (`listPayments` below already covers every purchased boost). */
  async revokeBoost(listingId: string): Promise<void> {
    await this.prisma.listing.update({ where: { id: listingId }, data: { boostedUntil: null, boostRank: null } });
  }

  /** Every purchase in one feed, whatever its purpose — the boosts-only screen above only ever
   * covers `listing_boost`; this is where support looks up a Bhavano Plus/Agent Pro/seller slot
   * pack/contact-reveal-credits/instant-alerts purchase instead of hunting through five separate
   * screens. `expiresAt` isn't a Payment column — it's read off whichever of the four
   * purpose-specific audit-trail rows this payment actually created (see AdminPaymentDto's own
   * doc comment), so it's resolved here per-row rather than in the query itself. */
  async listPayments(query: ListPaymentsDto): Promise<AdminPaymentsPage> {
    const { offset, from, to, userId, purpose, status, listingTitle, sort, limit } = query;

    const where: Prisma.PaymentWhereInput = {
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(userId ? { userId } : {}),
      ...(purpose ? { purpose } : {}),
      ...(status ? { status } : {}),
    };
    const listingTitleClause = parseTextFilter(listingTitle);
    // parseTextFilter is typed for Visit's nullable string columns (StringNullableFilter);
    // Listing.title is required, so its own filter type (StringFilter) has no `| null` on
    // `equals` — parseTextFilter never actually produces one (see its own doc comment), so this
    // is a safe narrowing, not a real type mismatch.
    if (listingTitleClause) where.listing = { title: listingTitleClause as Prisma.StringFilter };

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true, email: true } },
          listing: { select: { title: true } },
          discountCode: { select: { code: true } },
          listingBoost: { select: { boostedUntil: true } },
          listingInstantAlert: { select: { activeUntil: true } },
          subscription: { select: { endsAt: true } },
          contactRevealCreditBatch: { select: { expiresAt: true } },
        },
        orderBy: ADMIN_PAYMENT_ORDER_BY[sort ?? 'createdAt_desc'],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: rows.map((p) => {
        const expiresAt =
          p.listingBoost?.boostedUntil ??
          p.listingInstantAlert?.activeUntil ??
          p.subscription?.endsAt ??
          p.contactRevealCreditBatch?.expiresAt ??
          null;

        return {
          id: p.id,
          purpose: p.purpose,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
          paidAt: p.paidAt?.toISOString() ?? null,
          expiresAt: expiresAt?.toISOString() ?? null,
          userId: p.userId,
          userName: p.user.name,
          userPhone: p.user.phone,
          userEmail: p.user.email,
          ...(p.listingId ? { listingId: p.listingId, listingTitle: p.listing?.title } : {}),
          ...(p.boostDays ? { boostDays: p.boostDays } : {}),
          ...(p.boostIncludesInstantAlerts ? { boostIncludesInstantAlerts: true } : {}),
          ...(p.subscriptionMonths ? { subscriptionMonths: p.subscriptionMonths } : {}),
          ...(p.agentProUnits ? { agentProUnits: p.agentProUnits } : {}),
          ...(p.creditPackSize ? { creditPackSize: p.creditPackSize } : {}),
          ...(p.discountCode ? { discountCode: p.discountCode.code } : {}),
        };
      }),
      total,
    };
  }

  /** The unmet-demand queue — Phase 0 of docs/plans/property-requirements-demand-side.md.
   *
   * This screen *is* the matching engine for now. At 1-3 captures a day a person reads each one,
   * searches the catalogue by hand, calls the seeker, or points outreach at owners in that exact
   * area — which is also how the inventory those areas lack gets recruited. `openTotal` is
   * deliberately unfiltered: it answers "is anyone actually working this?", which a filtered
   * count cannot. */
  async listRequirements(query: ListRequirementsDto): Promise<AdminRequirementsPage> {
    const { status, offset, limit } = query;
    const where: Prisma.RequirementWhereInput = status ? { status } : {};

    const [rows, total, openTotal] = await Promise.all([
      this.prisma.requirement.findMany({
        where,
        include: {
          city: true,
          area: true,
          seeker: { select: { name: true, phone: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset ?? 0,
        take: limit,
      }),
      this.prisma.requirement.count({ where }),
      this.prisma.requirement.count({ where: { status: 'open' } }),
    ]);

    return {
      items: rows.map((row) => ({
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
        isExpired: row.expiresAt.getTime() <= Date.now(),
        hasAlert: row.savedSearchId !== null,
        contactConsent: row.contactConsentAt !== null,
        createdAt: row.createdAt.toISOString(),
        seekerId: row.seekerId,
        seekerName: row.seeker.name,
        seekerPhone: row.seeker.phone,
        seekerEmail: row.seeker.email,
        adminNote: row.adminNote ?? undefined,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      openTotal,
    };
  }

  async updateRequirement(id: string, dto: UpdateRequirementDto): Promise<void> {
    const existing = await this.prisma.requirement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Requirement not found');
    await this.prisma.requirement.update({ where: { id }, data: dto });
  }

  getSavedSearchSettings(): Promise<SavedSearchSettingsDto> {
    return this.savedSearchesService.getSettings();
  }

  updateSavedSearchSettings(dto: UpdateSavedSearchSettingsDto): Promise<SavedSearchSettingsDto> {
    return this.savedSearchesService.updateSettings(dto.freeAlertsPerUser);
  }

  /**
   * What people search for, aggregated — and specifically what they search for and don't find.
   *
   * An aggregate rather than a list of individual searches, because the actionable question is
   * "which area and category do people keep asking for that we have nothing in", not "what did
   * session X do". `emptySearches` is the inventory gap, and it is the column to sort by: a
   * city/area/category combination that people ask for repeatedly and that returns nothing is a
   * recruitment target for the outreach module.
   *
   * Grouped in SQL rather than in JS because the interesting windows are weeks wide: pulling
   * every row back to count them would move tens of thousands of rows to save writing one query.
   * `unnest` on `areaIds` means a search across three areas counts once per area, which is the
   * right reading — someone asking about three localities is expressing demand in all three.
   */
  async searchDemand(days: number, limit: number): Promise<SearchDemandPage> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<
      {
        cityName: string | null;
        areaName: string | null;
        category: string | null;
        transactionType: string | null;
        searches: number;
        emptySearches: number;
        avgResults: number;
        lastSearchedAt: Date;
      }[]
    >`
      SELECT c."name" AS "cityName",
             a."name" AS "areaName",
             se."category"::text AS "category",
             se."transactionType"::text AS "transactionType",
             COUNT(*)::int AS "searches",
             COUNT(*) FILTER (WHERE se."resultCount" = 0)::int AS "emptySearches",
             ROUND(AVG(se."resultCount")::numeric, 1)::float8 AS "avgResults",
             MAX(se."createdAt") AS "lastSearchedAt"
      FROM "SearchEvent" se
      LEFT JOIN "City" c ON c."id" = se."cityId"
      -- One row per (search, area) so a three-area search counts as demand in all three; a
      -- search with no area narrowing contributes a single row with a null area.
      LEFT JOIN LATERAL unnest(CASE WHEN cardinality(se."areaIds") = 0 THEN ARRAY[NULL]::text[] ELSE se."areaIds" END) AS area_id ON TRUE
      LEFT JOIN "Area" a ON a."id" = area_id
      WHERE se."createdAt" >= ${since}
      GROUP BY 1, 2, 3, 4
      ORDER BY "emptySearches" DESC, "searches" DESC
      LIMIT ${limit}`;

    const [totals] = await this.prisma.$queryRaw<{ totalSearches: number; totalEmptySearches: number }[]>`
      SELECT COUNT(*)::int AS "totalSearches",
             COUNT(*) FILTER (WHERE "resultCount" = 0)::int AS "totalEmptySearches"
      FROM "SearchEvent" WHERE "createdAt" >= ${since}`;

    const topQueries = await this.prisma.$queryRaw<{ q: string; searches: number; emptySearches: number }[]>`
      SELECT "q", COUNT(*)::int AS "searches", COUNT(*) FILTER (WHERE "resultCount" = 0)::int AS "emptySearches"
      FROM "SearchEvent"
      WHERE "createdAt" >= ${since} AND "q" IS NOT NULL AND "q" <> ''
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20`;

    return {
      rows: rows.map((row) => ({
        cityName: row.cityName,
        areaName: row.areaName,
        category: (row.category ?? undefined) as SearchDemandRowDto['category'],
        transactionType: (row.transactionType ?? undefined) as SearchDemandRowDto['transactionType'],
        searches: row.searches,
        emptySearches: row.emptySearches,
        avgResults: row.avgResults,
        lastSearchedAt: row.lastSearchedAt.toISOString(),
      })),
      totalSearches: totals?.totalSearches ?? 0,
      totalEmptySearches: totals?.totalEmptySearches ?? 0,
      topQueries,
    };
  }
}
