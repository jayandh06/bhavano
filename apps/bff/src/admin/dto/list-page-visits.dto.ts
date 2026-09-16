import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DEVICE_TYPES } from '../../analytics/device-type';

/** One asc/desc pair per sortable column, so the admin table's headers can each be a sort
 * toggle. `pageViewCount` is deliberately absent: it isn't a column on Visit at all — it's
 * counted from PageView in a second groupBy after the page of rows is already chosen (see
 * AdminService.listPageVisits), so ordering by it would need a join/denormalised counter rather
 * than an orderBy. */
const PAGE_VISIT_SORT_VALUES = [
  'createdAt_desc',
  'createdAt_asc',
  'user_asc',
  'user_desc',
  'city_asc',
  'city_desc',
  'deviceType_asc',
  'deviceType_desc',
  'source_asc',
  'source_desc',
  'medium_asc',
  'medium_desc',
  'campaign_asc',
  'campaign_desc',
  'campaignId_asc',
  'campaignId_desc',
  'adGroupId_asc',
  'adGroupId_desc',
  'landingPath_asc',
  'landingPath_desc',
  'ip_asc',
  'ip_desc',
  'region_asc',
  'region_desc',
  'country_asc',
  'country_desc',
] as const;

export type PageVisitSort = (typeof PAGE_VISIT_SORT_VALUES)[number];

const PAGE_VISIT_IDENTITY_VALUES = ['any', 'anonymous', 'logged_in'] as const;

export type PageVisitIdentity = (typeof PAGE_VISIT_IDENTITY_VALUES)[number];

/** Crawler filter, against `Visit.isBot` — except `js_confirmed`, which is against
 * `Visit.jsConfirmedAt`.
 *
 * `unclassified` is a first-class option, not an oversight: every row written before that column
 * existed has no stored User-Agent to judge after the fact, and ~99.85% of those are in fact
 * crawler traffic. So "humans" here means *classified as not-a-bot*, which excludes all of that
 * history rather than pretending it's human — and `unclassified` is how you look at it.
 *
 * `js_confirmed` is strictly stronger than `humans` and is the one to reach for when the number
 * has to be defensible. `humans` trusts the visitor's own User-Agent, so a scraper announcing
 * itself as Safari is inside it (measured: datacentre hosts in 43.159.0.0/16 logging as
 * `deviceType: mobile`, `isBot: false`). `js_confirmed` requires that a JavaScript engine
 * actually ran, which a scripted client cannot fake by choosing a different header. It
 * undercounts rather than overcounts: a real visitor whose beacon was blocked or lost is absent
 * from it, and every session from before the column existed is too. */
const PAGE_VISIT_TRAFFIC_VALUES = ['any', 'humans', 'js_confirmed', 'bots', 'unclassified'] as const;

export type PageVisitTraffic = (typeof PAGE_VISIT_TRAFFIC_VALUES)[number];

/**
 * Each text filter (`source`, `medium`, `ip`, `landingPath`, `city`, `region`, `country`) is a
 * tiny query DSL, parsed by `parseTextFilter` in admin.service.ts — plain text is a
 * case-insensitive `contains`, and these prefixes/wrappers change the operator:
 *
 *   plain      →  contains        `koramangala`
 *   `x%`       →  starts with     `/bengaluru%`
 *   `%x`       →  ends with       `%/buy`
 *   `%x%`      →  contains (explicit)
 *   `{a, b}`   →  exact IN any of `{google, bing}`
 *   `!` prefix →  negate any of the above  `!{google}`  `!spam%`
 *
 * `from`/`to` arrive as full ISO strings with an offset already applied by the admin page (it
 * turns the IST date pickers into `…T00:00…+05:30` / `…T23:59:59.999+05:30`).
 */
export class ListPageVisitsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** `anonymous` = sessions never linked to a user (see `Visit.userId`/`linkVisitToUser`);
   * `logged_in` = sessions that were. Takes precedence over `userId` when both are sent, though
   * the admin page's own User picker and this filter are mutually exclusive in the UI already. */
  @IsOptional()
  @IsIn(PAGE_VISIT_IDENTITY_VALUES)
  identity?: PageVisitIdentity;

  /** See PAGE_VISIT_TRAFFIC_VALUES. Defaults to `humans` in the admin UI rather than here — the
   * API stays unfiltered unless asked, so a caller counting all traffic still can. */
  @IsOptional()
  @IsIn(PAGE_VISIT_TRAFFIC_VALUES)
  traffic?: PageVisitTraffic;

  @IsOptional()
  @IsIn(DEVICE_TYPES)
  deviceType?: (typeof DEVICE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  country?: string;

  @IsOptional()
  @IsIn(PAGE_VISIT_SORT_VALUES)
  sort?: PageVisitSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
