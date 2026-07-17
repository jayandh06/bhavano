import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ListingCategory, ModerationState } from '@bhavano/types';

const LISTING_CATEGORIES: ListingCategory[] = ['house', 'apartment', 'pg', 'storage', 'coworking', 'furniture'];
const MODERATION_STATES: ModerationState[] = ['approved', 'flagged'];

export class ListAdminListingsDto {
  @IsOptional()
  @IsIn(MODERATION_STATES)
  moderationState?: ModerationState;

  // Plain `@Type(() => Boolean)` calls `Boolean(value)` on the raw query string, and
  // `Boolean("false")` is `true` — this maps "true"/"false" explicitly instead.
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  adminReviewed?: boolean;

  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 24;
}
