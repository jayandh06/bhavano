import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ListingCategory, ModerationState, TransactionType } from '@bhavano/types';

const LISTING_CATEGORIES: ListingCategory[] = [
  'house',
  'apartment',
  'villa',
  'pg',
  'storage',
  'coworking',
  'furniture',
  'interiors',
  'plot',
  'commercial',
];
const MODERATION_STATES: ModerationState[] = ['approved', 'flagged'];
const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];
const ADMIN_LISTING_SORT_VALUES = ['createdAt_desc', 'createdAt_asc', 'updatedAt_desc', 'updatedAt_asc'] as const;

export type AdminListingSort = (typeof ADMIN_LISTING_SORT_VALUES)[number];

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
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  @IsOptional()
  @IsDateString()
  updatedTo?: string;

  @IsOptional()
  @IsIn(ADMIN_LISTING_SORT_VALUES)
  sort?: AdminListingSort;

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
