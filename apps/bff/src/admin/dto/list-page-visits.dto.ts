import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const PAGE_VISIT_SORT_VALUES = [
  'createdAt_desc',
  'createdAt_asc',
  'user_asc',
  'user_desc',
  'city_asc',
  'city_desc',
] as const;

export type PageVisitSort = (typeof PAGE_VISIT_SORT_VALUES)[number];

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

  /** Restricts to sessions never linked to a user (see `Visit.userId`/`linkVisitToUser`) — the
   * "who looked around without logging in" view. Takes precedence over `userId` when both are
   * sent, though the admin page's own User picker and this toggle are mutually exclusive in the
   * UI already. */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  anonymousOnly?: boolean;

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
