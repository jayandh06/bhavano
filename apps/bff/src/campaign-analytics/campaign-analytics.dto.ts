import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const GROUP_BY_VALUES = ['campaign', 'adGroup', 'ad', 'source', 'landing'] as const;
export type CampaignAnalyticsGroupBy = (typeof GROUP_BY_VALUES)[number];

/** Same meaning as the Page visits screen's Traffic filter (see ListPageVisitsDto): `humans` is
 * classified-as-not-a-bot, `js_confirmed` is stricter (a JS engine ran), `unclassified` is the
 * pre-filter history. */
export const TRAFFIC_VALUES = ['humans', 'js_confirmed', 'any', 'bots', 'unclassified'] as const;
export type CampaignAnalyticsTraffic = (typeof TRAFFIC_VALUES)[number];

/** Every column the table can be sorted by, ascending or descending. Whitelisted, because each maps
 * to a SQL expression (see SORT_SQL in the service); nothing from the URL is ever spliced in. */
export const SORT_COLUMNS = [
  'label',
  'visits',
  'bots',
  'engaged',
  'reachedPost',
  'signups',
  'posted',
  'paid',
  'revenue',
  'signupRate',
  'postedRate',
  'paidRate',
] as const;
export type CampaignAnalyticsSortColumn = (typeof SORT_COLUMNS)[number];

const SORT_VALUES = SORT_COLUMNS.flatMap((c) => [`${c}_asc`, `${c}_desc`]);

export class CampaignAnalyticsQueryDto {
  /** ISO timestamps with offset, as the other admin screens send (the page turns the IST date
   * pickers into start and end of day). Default: the last 7 days. */
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @IsIn(GROUP_BY_VALUES as unknown as string[]) groupBy?: CampaignAnalyticsGroupBy;
  @IsOptional() @IsIn(TRAFFIC_VALUES as unknown as string[]) traffic?: CampaignAnalyticsTraffic;
  @IsOptional() @IsIn(['any', 'web', 'app']) platform?: 'any' | 'web' | 'app';
  @IsOptional() @IsIn(['any', 'desktop', 'mobile', 'tablet', 'mobile_app']) deviceType?: string;
  /** `paid` = arrived on a Google Ads click (a gclid, or medium cpc); `organic` = everything else. */
  @IsOptional() @IsIn(['any', 'paid', 'organic']) paid?: 'any' | 'paid' | 'organic';
  /** `yes` keeps only rows with at least one sign-up, posted ad or payment; `no` only rows with none. */
  @IsOptional() @IsIn(['any', 'yes', 'no']) converted?: 'any' | 'yes' | 'no';

  /** Drill-down: only visits of this Google Ads campaign / ad group. */
  @IsOptional() @IsString() @MaxLength(40) campaignId?: string;
  @IsOptional() @IsString() @MaxLength(40) adGroupId?: string;

  /** Case-insensitive contains, against the row's label (its name, or its id when unnamed). */
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minVisits?: number;

  @IsOptional() @IsIn(SORT_VALUES) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}
