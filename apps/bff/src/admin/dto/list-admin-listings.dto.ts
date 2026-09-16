import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ListingCategory, ListingStatus, ModerationState, TransactionType } from '@bhavano/types';

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
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented', 'deactivated'];
/** One asc/desc pair per sortable column on the admin listings table, so each header can be a
 * sort toggle. `messageCount` is included even though it isn't a column on Listing — it's a
 * relation count, which Prisma can order by (`conversations: { _count }`), unlike the admin
 * page-visits screen's pageViewCount which is counted in a separate query. */
const ADMIN_LISTING_SORT_VALUES = [
  'createdAt_desc',
  'createdAt_asc',
  'updatedAt_desc',
  'updatedAt_asc',
  'status_asc',
  'status_desc',
  'title_asc',
  'title_desc',
  'category_asc',
  'category_desc',
  'transactionType_asc',
  'transactionType_desc',
  'moderationState_asc',
  'moderationState_desc',
  'source_asc',
  'source_desc',
  'claimSource_asc',
  'claimSource_desc',
  'price_asc',
  'price_desc',
  'viewCount_asc',
  'viewCount_desc',
  'likeCount_asc',
  'likeCount_desc',
  'messageCount_asc',
  'messageCount_desc',
  'expiresAt_asc',
  'expiresAt_desc',
] as const;

export type AdminListingSort = (typeof ADMIN_LISTING_SORT_VALUES)[number];

export class ListAdminListingsDto {
  @IsOptional()
  @IsString()
  search?: string;

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
  @IsIn(LISTING_STATUSES)
  status?: ListingStatus;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
