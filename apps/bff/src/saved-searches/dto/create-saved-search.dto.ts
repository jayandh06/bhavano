import { Type } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';
import { MAX_REQUIREMENT_AREAS } from '@bhavano/types/requirementQuestions';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';

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
const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];

export class CreateSavedSearchDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  @IsOptional()
  @IsString()
  cityId?: string;

  /** Existing area ids — composed with `areaName` below, not replaced by it. Capped here at the
   * same `MAX_REQUIREMENT_AREAS` the paired `Requirement` model uses; `create()` re-caps after
   * merging in `areaName`, since that step can push the total past what this alone can check. */
  @IsOptional()
  @ArrayMaxSize(MAX_REQUIREMENT_AREAS)
  @IsString({ each: true })
  areaIds?: string[];

  @IsOptional()
  @IsString()
  areaName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  /** BHK buckets, 5 = "5+" — see `bedroomLabel` (`@bhavano/types/bedrooms`). */
  @IsOptional()
  @ArrayMaxSize(MAX_BEDROOMS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_BEDROOMS, { each: true })
  bedroomOptions?: number[];
}
