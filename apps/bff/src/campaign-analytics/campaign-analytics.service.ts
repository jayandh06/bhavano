import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CampaignAnalyticsDto, CampaignAnalyticsRowDto } from '@bhavano/types/campaignAnalytics';
import { PrismaService } from '../prisma/prisma.service';
import { AD_GROUP_NAMES, CAMPAIGN_NAMES } from '../ads/campaign-names';
import type { CampaignAnalyticsGroupBy, CampaignAnalyticsQueryDto, CampaignAnalyticsSortColumn } from './campaign-analytics.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
/** After a visit starts, how long a sign-up or payment still counts as coming from that visit. */
const CONVERSION_WINDOW_HOURS = 24;
/** Groups read from the database before sorting and trimming in memory. Landing pages are the only
 * grouping that could come close; the rest have tens to hundreds. */
const MAX_GROUPS = 5000;
const DEFAULT_LIMIT = 200;

interface RawRow {
  key: string;
  campaignId: string | null;
  adGroupId: string | null;
  visits: bigint | number;
  bots: bigint | number;
  engaged: bigint | number;
  reachedPost: bigint | number;
  signups: bigint | number;
  posted: bigint | number;
  paid: bigint | number;
  revenuePaise: bigint | number | null;
}

/** A group key for traffic that did not come from a numbered Google Ads campaign, ad group or ad:
 * "src:google / organic", "src:direct / none"… Real ids are digits only, so the prefix is safe. */
const SOURCE_KEY_PREFIX = 'src:';

const SOURCE_KEY = Prisma.sql`'src:' || COALESCE(v."source", 'direct') || ' / ' || COALESCE(v."medium", 'none')`;

function keyExpression(groupBy: CampaignAnalyticsGroupBy): Prisma.Sql {
  switch (groupBy) {
    case 'campaign':
      return Prisma.sql`CASE WHEN v."campaignId" IS NOT NULL THEN v."campaignId" ELSE ${SOURCE_KEY} END`;
    case 'adGroup':
      return Prisma.sql`CASE WHEN v."adGroupId" IS NOT NULL THEN v."adGroupId" ELSE ${SOURCE_KEY} END`;
    case 'ad':
      return Prisma.sql`CASE WHEN v."adId" IS NOT NULL THEN v."adId" ELSE ${SOURCE_KEY} END`;
    case 'source':
      return SOURCE_KEY;
    case 'landing':
      return Prisma.sql`COALESCE(v."landingPath", '(unknown)')`;
  }
}

/** The visit-level conditions. Every value is a bound parameter; only fixed fragments are spliced. */
function visitFilters(q: CampaignAnalyticsQueryDto, from: Date, to: Date): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`v."createdAt" >= ${from}`, Prisma.sql`v."createdAt" <= ${to}`];

  switch (q.traffic ?? 'humans') {
    case 'humans':
      conditions.push(Prisma.sql`v."isBot" = false`);
      break;
    case 'js_confirmed':
      conditions.push(Prisma.sql`v."jsConfirmedAt" IS NOT NULL`);
      break;
    case 'bots':
      conditions.push(Prisma.sql`v."isBot" = true`);
      break;
    case 'unclassified':
      conditions.push(Prisma.sql`v."isBot" IS NULL`);
      break;
    case 'any':
      break;
  }

  if (q.platform === 'app') conditions.push(Prisma.sql`v."deviceType" = 'mobile_app'`);
  if (q.platform === 'web') conditions.push(Prisma.sql`v."deviceType" IS DISTINCT FROM 'mobile_app'`);
  if (q.deviceType && q.deviceType !== 'any') conditions.push(Prisma.sql`v."deviceType" = ${q.deviceType}`);

  const paidClick = Prisma.sql`(v."gclid" IS NOT NULL OR v."medium" = 'cpc')`;
  if (q.paid === 'paid') conditions.push(paidClick);
  if (q.paid === 'organic') conditions.push(Prisma.sql`NOT ${paidClick}`);

  if (q.campaignId) conditions.push(Prisma.sql`v."campaignId" = ${q.campaignId}`);
  if (q.adGroupId) conditions.push(Prisma.sql`v."adGroupId" = ${q.adGroupId}`);
  return conditions;
}

/** The whole report query: one row per group with counts of sessions at each step. Exported so the
 * SQL shape can be tested without a database. */
export function buildCampaignAnalyticsSql(q: CampaignAnalyticsQueryDto, from: Date, to: Date): Prisma.Sql {
  const where = Prisma.join(visitFilters(q, from, to), ' AND ');
  const key = keyExpression(q.groupBy ?? 'campaign');
  const window = Prisma.sql`${CONVERSION_WINDOW_HOURS} * interval '1 hour'`;
  const pageViewEnd = new Date(to.getTime() + DAY_MS);

  return Prisma.sql`
    WITH base AS (
      SELECT v."sessionId", v."userId", v."createdAt", v."isBot", v."campaignId", v."adGroupId",
             ${key} AS "groupKey"
      FROM "Visit" v
      WHERE ${where}
    ),
    pages AS (
      SELECT p."sessionId", count(*) AS n, bool_or(p."path" = '/post') AS "reachedPost"
      FROM "PageView" p
      WHERE p."createdAt" >= ${from} AND p."createdAt" <= ${pageViewEnd}
        AND p."sessionId" IN (SELECT "sessionId" FROM base)
      GROUP BY p."sessionId"
    ),
    outcome AS (
      SELECT b."sessionId",
             (u."id" IS NOT NULL AND u."createdAt" >= b."createdAt" AND u."createdAt" <= b."createdAt" + ${window}) AS "signedUp",
             EXISTS (SELECT 1 FROM "Listing" l WHERE l."createSessionId" = b."sessionId") AS "posted",
             (SELECT COALESCE(sum(pay."amount"), 0) FROM "Payment" pay
                WHERE pay."userId" = b."userId" AND pay."status" = 'paid'
                  AND pay."paidAt" >= b."createdAt" AND pay."paidAt" <= b."createdAt" + ${window}) AS "revenuePaise",
             EXISTS (SELECT 1 FROM "Payment" pay
                WHERE pay."userId" = b."userId" AND pay."status" = 'paid'
                  AND pay."paidAt" >= b."createdAt" AND pay."paidAt" <= b."createdAt" + ${window}) AS "paid"
      FROM base b
      LEFT JOIN "User" u ON u."id" = b."userId"
    )
    SELECT b."groupKey" AS "key",
           max(b."campaignId") AS "campaignId",
           max(b."adGroupId") AS "adGroupId",
           count(*) AS "visits",
           count(*) FILTER (WHERE b."isBot" = true) AS "bots",
           count(*) FILTER (WHERE pages.n >= 2) AS "engaged",
           count(*) FILTER (WHERE pages."reachedPost") AS "reachedPost",
           count(*) FILTER (WHERE o."signedUp") AS "signups",
           count(*) FILTER (WHERE o."posted") AS "posted",
           count(*) FILTER (WHERE o."paid") AS "paid",
           sum(o."revenuePaise") AS "revenuePaise"
    FROM base b
    LEFT JOIN pages ON pages."sessionId" = b."sessionId"
    LEFT JOIN outcome o ON o."sessionId" = b."sessionId"
    GROUP BY b."groupKey"
    ORDER BY count(*) DESC
    LIMIT ${MAX_GROUPS}
  `;
}

const n = (value: bigint | number | null | undefined): number => Number(value ?? 0);

/** A readable name for a group: a campaign or ad group's name when known, the source for traffic
 * that did not come from an ad, otherwise the bare id (a campaign created after the name list was
 * last updated). */
function labelFor(key: string, groupBy: CampaignAnalyticsGroupBy): string {
  if (key.startsWith(SOURCE_KEY_PREFIX)) return key.slice(SOURCE_KEY_PREFIX.length);
  if (groupBy === 'campaign') return CAMPAIGN_NAMES[key] ?? key;
  if (groupBy === 'adGroup') return AD_GROUP_NAMES[key] ?? key;
  return key;
}

export function toRow(raw: RawRow, groupBy: CampaignAnalyticsGroupBy): CampaignAnalyticsRowDto {
  const fromAds = !raw.key.startsWith(SOURCE_KEY_PREFIX) && (groupBy === 'campaign' || groupBy === 'adGroup' || groupBy === 'ad');
  return {
    key: raw.key,
    label: labelFor(raw.key, groupBy),
    fromAds,
    campaignId: fromAds ? raw.campaignId : null,
    campaignName: fromAds && raw.campaignId ? (CAMPAIGN_NAMES[raw.campaignId] ?? null) : null,
    adGroupId: fromAds ? raw.adGroupId : null,
    adGroupName: fromAds && raw.adGroupId ? (AD_GROUP_NAMES[raw.adGroupId] ?? null) : null,
    visits: n(raw.visits),
    bots: n(raw.bots),
    engaged: n(raw.engaged),
    reachedPost: n(raw.reachedPost),
    signups: n(raw.signups),
    posted: n(raw.posted),
    paid: n(raw.paid),
    revenue: n(raw.revenuePaise) / 100,
  };
}

const rate = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);

const SORT_VALUE: Record<CampaignAnalyticsSortColumn, (r: CampaignAnalyticsRowDto) => number | string> = {
  label: (r) => r.label.toLowerCase(),
  visits: (r) => r.visits,
  bots: (r) => r.bots,
  engaged: (r) => r.engaged,
  reachedPost: (r) => r.reachedPost,
  signups: (r) => r.signups,
  posted: (r) => r.posted,
  paid: (r) => r.paid,
  revenue: (r) => r.revenue,
  signupRate: (r) => rate(r.signups, r.visits),
  postedRate: (r) => rate(r.posted, r.visits),
  paidRate: (r) => rate(r.paid, r.visits),
};

/** Search, conversion and minimum-visit filters, then the sort and limit. In memory, because the
 * label (a campaign's name) is not in the database and the group count is small. */
export function shapeRows(
  rows: CampaignAnalyticsRowDto[],
  q: CampaignAnalyticsQueryDto,
): { rows: CampaignAnalyticsRowDto[]; matched: CampaignAnalyticsRowDto[]; truncated: boolean } {
  const search = q.search?.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (search && !r.label.toLowerCase().includes(search) && !r.key.toLowerCase().includes(search)) return false;
    if (q.minVisits && r.visits < q.minVisits) return false;
    const converted = r.signups > 0 || r.posted > 0 || r.paid > 0;
    if (q.converted === 'yes' && !converted) return false;
    if (q.converted === 'no' && converted) return false;
    return true;
  });

  const [column, direction] = parseSort(q.sort);
  const value = SORT_VALUE[column];
  out = [...out].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const order = av < bv ? -1 : av > bv ? 1 : 0;
    // Ties fall back to visits then label, so the order is stable between reloads.
    return (direction === 'asc' ? order : -order) || b.visits - a.visits || a.label.localeCompare(b.label);
  });

  const limit = q.limit ?? DEFAULT_LIMIT;
  return { rows: out.slice(0, limit), matched: out, truncated: out.length > limit };
}

export function parseSort(sort: string | undefined): [CampaignAnalyticsSortColumn, 'asc' | 'desc'] {
  const match = /^([a-zA-Z]+)_(asc|desc)$/.exec(sort ?? '');
  if (match && match[1] in SORT_VALUE) return [match[1] as CampaignAnalyticsSortColumn, match[2] as 'asc' | 'desc'];
  return ['visits', 'desc'];
}

@Injectable()
export class CampaignAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(query: CampaignAnalyticsQueryDto, now: Date = new Date()): Promise<CampaignAnalyticsDto> {
    const to = query.to ? new Date(query.to) : now;
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 7 * DAY_MS);
    const groupBy = query.groupBy ?? 'campaign';

    const raw = await this.prisma.$queryRaw<RawRow[]>(buildCampaignAnalyticsSql({ ...query, groupBy }, from, to));
    const all = raw.map((r) => toRow(r, groupBy));
    const { rows, matched, truncated } = shapeRows(all, query);
    // Totals cover every row that matches the filters, not only the page shown.
    const total = (pick: (r: CampaignAnalyticsRowDto) => number) => matched.reduce((s, r) => s + pick(r), 0);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      rows,
      truncated,
      totals: {
        visits: total((r) => r.visits),
        bots: total((r) => r.bots),
        engaged: total((r) => r.engaged),
        reachedPost: total((r) => r.reachedPost),
        signups: total((r) => r.signups),
        posted: total((r) => r.posted),
        paid: total((r) => r.paid),
        revenue: total((r) => r.revenue),
      },
    };
  }
}
