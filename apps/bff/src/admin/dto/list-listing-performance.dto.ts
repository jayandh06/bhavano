import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** One asc/desc pair per sortable column on the Listing performance screen
 * (docs/plans/admin-listing-performance-screen.md). `enquiryCount`/`contactRevealCount` are
 * included even though they aren't columns on Listing — both are relation counts, which Prisma
 * can order by directly (same precedent as the main listings table's `messageCount`). The
 * message-derived stats (totalMessages/uniqueMessageSenders/repliedThreads) and the view split
 * (loggedInViews/anonymousViews) have NO pair here — they're computed in-memory per page (see
 * ListingsService.listPerformanceForAdmin), the same "can't be ordered on" situation the admin
 * page-visits screen's pageViewCount already documents. */
const LISTING_PERFORMANCE_SORT_VALUES = [
  'createdAt_desc',
  'createdAt_asc',
  'title_asc',
  'title_desc',
  'category_asc',
  'category_desc',
  'transactionType_asc',
  'transactionType_desc',
  'viewCount_asc',
  'viewCount_desc',
  'organicViewCount_asc',
  'organicViewCount_desc',
  'likeCount_asc',
  'likeCount_desc',
  'enquiryCount_asc',
  'enquiryCount_desc',
  'contactRevealCount_asc',
  'contactRevealCount_desc',
  'boosted_asc',
  'boosted_desc',
] as const;

export type ListingPerformanceSort = (typeof LISTING_PERFORMANCE_SORT_VALUES)[number];
export { LISTING_PERFORMANCE_SORT_VALUES };

export class ListListingPerformanceDto {
  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(LISTING_PERFORMANCE_SORT_VALUES)
  sort?: ListingPerformanceSort;

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
