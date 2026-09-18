import { Type } from 'class-transformer';
import { IsBooleanString, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { LoginMethod } from '@bhavano/types';

const LOGIN_METHODS: LoginMethod[] = ['otp', 'google', 'apple'];
// One row per user now (see AdminService.listRecentLogins), so the sortable columns are the
// per-user summary fields, not a raw LoginEvent column.
const LOGIN_SORT_VALUES = [
  'lastLoginAt_desc',
  'lastLoginAt_asc',
  'firstLoginAt_desc',
  'firstLoginAt_asc',
  'userName_asc',
  'userName_desc',
] as const;

export type LoginSort = (typeof LOGIN_SORT_VALUES)[number];

export class ListLoginsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** Bounds `lastLoginAt` — "show me users active in this window", the question this screen is
   * actually for. A user whose first login (but not last) falls in range is deliberately not
   * matched; browse by `sort=firstLoginAt_desc` for that question instead. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** Matches against name/phone/email, same free-text convention as every other admin list's
   * search field. */
  @IsOptional()
  @IsString()
  search?: string;

  /** The most recent login's method specifically, not "used this method at any point ever". */
  @IsOptional()
  @IsIn(LOGIN_METHODS)
  method?: LoginMethod;

  /** class-validator has no plain IsIn(['yes','no']) shorthand as clean as IsBooleanString for a
   * checkbox-shaped filter — 'true'/'false' (also '1'/'0') coming off a <select> or query string. */
  @IsOptional()
  @IsBooleanString()
  isNewUser?: string;

  @IsOptional()
  @IsBooleanString()
  hasPostedAd?: string;

  @IsOptional()
  @IsIn(LOGIN_SORT_VALUES)
  sort?: LoginSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
