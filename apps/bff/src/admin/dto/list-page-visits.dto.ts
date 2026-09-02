import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const PAGE_VISIT_SORT_VALUES = ['createdAt_desc', 'createdAt_asc'] as const;

export type PageVisitSort = (typeof PAGE_VISIT_SORT_VALUES)[number];

/** Every text filter below is an case-insensitive `contains` match server-side — this is an
 * internal analytics view, so "rows matching X" (an IP prefix, a path, "google") is more useful
 * than exact equality. `from`/`to` arrive as full ISO strings with an offset already applied by
 * the admin page (it turns the IST date pickers into `…T00:00…+05:30` / `…T23:59:59.999+05:30`). */
export class ListPageVisitsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  userId?: string;

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
  limit: number = 50;
}
