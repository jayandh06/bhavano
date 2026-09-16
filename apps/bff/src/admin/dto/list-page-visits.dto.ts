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
