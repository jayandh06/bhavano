import type { PrismaService } from '../prisma/prisma.service';
import {
  buildCampaignAnalyticsSql,
  usesFirstClick,
  CampaignAnalyticsService,
  parseSort,
  shapeRows,
  toRow,
} from './campaign-analytics.service';

const FROM = new Date('2026-10-01T00:00:00+05:30');
const TO = new Date('2026-10-07T23:59:59+05:30');

function raw(over: Record<string, unknown> = {}) {
  return {
    key: '24192021092',
    campaignId: '24192021092',
    adGroupId: null,
    visits: 100,
    bots: 0,
    engaged: 60,
    reachedPost: 20,
    signups: 10,
    posted: 4,
    paid: 2,
    revenuePaise: 150000,
    ...over,
  } as Parameters<typeof toRow>[0];
}

describe('buildCampaignAnalyticsSql', () => {
  const text = (q = {}) => buildCampaignAnalyticsSql(q, FROM, TO).sql;

  it('binds the dates and never splices request values into the text', () => {
    const sql = buildCampaignAnalyticsSql({ campaignId: "1' OR '1'='1" }, FROM, TO);
    expect(sql.sql).not.toContain("OR '1'='1");
    expect(sql.values).toEqual(expect.arrayContaining([FROM, TO, "1' OR '1'='1"]));
  });

  it('keeps humans only by default and lets the traffic filter widen it', () => {
    expect(text()).toContain('v."isBot" = false');
    expect(text({ traffic: 'any' })).not.toContain('v."isBot" = false');
    expect(text({ traffic: 'js_confirmed' })).toContain('"jsConfirmedAt" IS NOT NULL');
    expect(text({ traffic: 'bots' })).toContain('v."isBot" = true');
  });

  it('separates the app from the website', () => {
    expect(text({ platform: 'app' })).toContain(`v."deviceType" = 'mobile_app'`);
    expect(text({ platform: 'web' })).toContain(`IS DISTINCT FROM 'mobile_app'`);
  });

  it('filters paid ad clicks against everything else', () => {
    expect(text({ paid: 'paid' })).toContain(`v."gclid" IS NOT NULL OR v."medium" IN ('cpc', 'paid_social')`);
    expect(text({ paid: 'organic' })).toContain('NOT COALESCE(');
  });

  it('narrows paid clicks to one ad network', () => {
    expect(text({ paid: 'meta' })).toContain(`v."medium" = 'paid_social'`);
    const google = text({ paid: 'google' });
    expect(google).toContain(`v."gclid" IS NOT NULL OR v."medium" = 'cpc'`);
    expect(google).toContain(`v."medium" IS DISTINCT FROM 'paid_social'`);
    expect(text()).not.toContain(`v."medium" = 'paid_social'`);
  });

  it('counts a payment or sign-up once when the user had several visits inside the window', () => {
    // Checked against a real Postgres on 2026-11-01: one user, two sessions 28 minutes apart and one payment gave paid 2 and double
    // the revenue before the guard. The guard hands each payment and sign-up to the user's first covering visit in the view.
    const sql = text();
    expect(sql.match(/NOT EXISTS \(SELECT 1 FROM base e/g)).toHaveLength(3);
    expect(sql).toContain('e."createdAt" < b."createdAt"');
  });

  it("credits conversions to the person's first landing in first-click mode", () => {
    // Run against a real Postgres on 2026-11-01: a user who clicked an ad, signed up, came back direct and posted gave the ad one
    // sign-up, post and payment; visit mode gave the post and payment to "direct".
    const sql = text({ attribution: 'first_click' });
    expect(sql).toContain('FULL OUTER JOIN acq');
    expect(sql).toContain('u."acquisitionCampaignId"');
    expect(sql).toContain('FROM "LoginEvent" le');
    expect(text({ attribution: 'first_click', groupBy: 'adGroup' })).toContain('u."acquisitionAdGroupId"');
    expect(text({ attribution: 'first_click', paid: 'google' })).toContain('u."acquisitionGclid" IS NOT NULL');
    expect(text({ attribution: 'first_click', campaignId: '111' })).toContain('u."acquisitionCampaignId" =');
    expect(text()).not.toContain('FULL OUTER JOIN acq');
  });

  it('keeps visit attribution for the landing page, which an account does not record', () => {
    expect(usesFirstClick({ attribution: 'first_click', groupBy: 'landing' })).toBe(false);
    expect(usesFirstClick({ attribution: 'first_click' })).toBe(true);
    expect(usesFirstClick({ attribution: 'visit' })).toBe(false);
    expect(text({ attribution: 'first_click', groupBy: 'landing' })).not.toContain('FULL OUTER JOIN acq');
  });

  it('groups by the chosen dimension', () => {
    expect(text({ groupBy: 'adGroup' })).toContain('v."adGroupId" IS NOT NULL');
    expect(text({ groupBy: 'ad' })).toContain('v."adId" IS NOT NULL');
    expect(text({ groupBy: 'landing' })).toContain('v."landingPath"');
    expect(text({ groupBy: 'source' })).toContain(`'src:' ||`);
  });

  it('is a parameterised query: numbered placeholders and a separate values list', () => {
    const sql = buildCampaignAnalyticsSql({}, FROM, TO);
    expect(sql.text).toContain('$1');
    expect(sql.values.length).toBeGreaterThan(2);
  });
});

describe('toRow', () => {
  it('names a known campaign and turns paise into rupees', () => {
    const row = toRow(raw(), 'campaign');
    expect(row.label).toBe('Metro-Generic Post Ad Intent');
    expect(row.fromAds).toBe(true);
    expect(row.revenue).toBe(1500);
  });

  it('keeps an unknown campaign id as its label', () => {
    expect(toRow(raw({ key: '999', campaignId: '999' }), 'campaign').label).toBe('999');
    // A Meta campaign (an 18-digit id) not in the name list yet is shown by the utm_campaign its ad sent; a short Google id never is.
    expect(toRow(raw({ key: '120250394350500061', campaignId: '120250394350500061', utmCampaign: 'Owners Bengaluru' } as never), 'campaign').label).toBe('Owners Bengaluru');
    expect(toRow(raw({ key: '999', campaignId: '999', utmCampaign: 'something' } as never), 'campaign').label).toBe('999');
  });

  it('labels non-ad traffic by its source and does not offer a drill-down', () => {
    const row = toRow(raw({ key: 'src:google / organic', campaignId: null }), 'campaign');
    expect(row.label).toBe('google / organic');
    expect(row.fromAds).toBe(false);
    expect(row.campaignId).toBeNull();
  });

  it('names an ad by its headlines, and keeps an unknown ad as its number', () => {
    expect(toRow(raw({ key: '827486614269', adGroupId: '199595834373' }), 'ad').label).toBe(
      'Post House For Rent / List Flat For Rent Online (...4269)',
    );
    expect(toRow(raw({ key: '111', adGroupId: null }), 'ad').label).toBe('111');
  });

  it('turns database bigints into numbers', () => {
    expect(toRow(raw({ visits: BigInt(7), revenuePaise: null }), 'campaign')).toMatchObject({ visits: 7, revenue: 0 });
  });
});

describe('shapeRows', () => {
  const rows = [
    toRow(raw({ key: 'src:google / organic', campaignId: null, visits: 500, signups: 0, posted: 0, paid: 0, revenuePaise: 0 }), 'campaign'),
    toRow(raw({ key: '24192021092', visits: 100, signups: 10 }), 'campaign'),
    toRow(raw({ key: '24186099720', campaignId: '24186099720', visits: 40, signups: 8, posted: 0, paid: 0, revenuePaise: 0 }), 'campaign'),
  ];

  it('sorts by visits, largest first, unless told otherwise', () => {
    expect(shapeRows(rows, {}).rows.map((r) => r.visits)).toEqual([500, 100, 40]);
  });

  it('sorts by any column in either direction', () => {
    expect(shapeRows(rows, { sort: 'signups_desc' }).rows[0].signups).toBe(10);
    expect(shapeRows(rows, { sort: 'signups_asc' }).rows[0].signups).toBe(0);
  });

  it('sorts by a rate, not the raw count', () => {
    // 8 of 40 (20%) beats 10 of 100 (10%) although it has fewer sign-ups.
    expect(shapeRows(rows, { sort: 'signupRate_desc' }).rows[0].visits).toBe(40);
  });

  it('filters by name or id, case-insensitively', () => {
    expect(shapeRows(rows, { search: 'GENERIC' }).rows).toHaveLength(1);
    expect(shapeRows(rows, { search: '24186099720' }).rows).toHaveLength(1);
  });

  it('keeps only converting rows, or only the ones that did not', () => {
    expect(shapeRows(rows, { converted: 'yes' }).rows).toHaveLength(2);
    expect(shapeRows(rows, { converted: 'no' }).rows).toHaveLength(1);
  });

  it('drops rows below a minimum number of visits', () => {
    expect(shapeRows(rows, { minVisits: 100 }).rows).toHaveLength(2);
  });

  it('limits the rows shown but reports every match for the totals', () => {
    const shaped = shapeRows(rows, { limit: 1 });
    expect(shaped.rows).toHaveLength(1);
    expect(shaped.matched).toHaveLength(3);
    expect(shaped.truncated).toBe(true);
  });
});

describe('parseSort', () => {
  it('accepts a known column and direction', () => {
    expect(parseSort('paidRate_asc')).toEqual(['paidRate', 'asc']);
  });

  it('falls back to visits, descending, for anything else', () => {
    expect(parseSort(undefined)).toEqual(['visits', 'desc']);
    expect(parseSort('drop table_asc')).toEqual(['visits', 'desc']);
  });
});

describe('CampaignAnalyticsService.report', () => {
  it('defaults to the last seven days and totals every matching row', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([raw({ visits: BigInt(100) }), raw({ key: '24186099720', campaignId: '24186099720', visits: BigInt(50) })]),
    } as unknown as PrismaService;
    const now = new Date('2026-10-24T10:00:00Z');

    const result = await new CampaignAnalyticsService(prisma).report({}, now);

    expect(result.groupBy).toBe('campaign');
    expect(result.to).toBe(now.toISOString());
    expect(new Date(result.from).getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(result.totals.visits).toBe(150);
    expect(result.totals.revenue).toBe(3000);
  });
});
