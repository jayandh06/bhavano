import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';

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

/** Mirrors CreateSavedSearchDto's criteria vocabulary deliberately — the same fields the matcher
 * already speaks, so one prompt can create both without translating between two shapes. */
export class CreateRequirementDto {
  /** How the search was described to the seeker, e.g. "2 BHK apartments for rent in Koramangala,
   * Bengaluru". Doubles as the alert's name when one is created alongside. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  searchLabel!: string;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms?: number;

  /** The page the empty search happened on — what makes "which areas have no supply" answerable
   * later. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingPath?: string;
}
