import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';
import { MAX_REQUIREMENT_AREAS } from '@bhavano/types/requirementQuestions';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import type { AdminUpdateSavedSearchInput } from '@bhavano/types';

const LISTING_CATEGORIES: ListingCategory[] = [
  'house', 'apartment', 'villa', 'pg', 'storage', 'coworking', 'furniture', 'interiors', 'plot', 'commercial',
];
const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];

export class UpdateSavedSearchDto implements AdminUpdateSavedSearchInput {
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
  @MinLength(1)
  cityId?: string;

  @IsArray()
  @ArrayMaxSize(MAX_REQUIREMENT_AREAS)
  @IsString({ each: true })
  areaIds!: string[];

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

  @IsArray()
  @ArrayMaxSize(MAX_BEDROOMS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_BEDROOMS, { each: true })
  bedroomOptions!: number[];
}
