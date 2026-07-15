import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { HomeCategoryFilter, ListingCategory, PropertyTypeFilter, TransactionType } from '@bhavano/types';

const HOME_CATEGORIES: HomeCategoryFilter[] = ['buy', 'rentLease', 'pg', 'furniture'];
const PROPERTY_TYPES: PropertyTypeFilter[] = ['house', 'apartment', 'storage', 'coworking'];
const LISTING_CATEGORIES: ListingCategory[] = ['house', 'apartment', 'pg', 'storage', 'coworking', 'furniture'];
const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];
const FURNISHING_VALUES = ['unfurnished', 'semi', 'furnished'] as const;

export class ListListingsDto {
  @IsOptional()
  @IsIn(HOME_CATEGORIES)
  homeCategory?: HomeCategoryFilter;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: PropertyTypeFilter;

  /** Raw exact-category filter — used only by the SEO browse-landing pages, bypasses
   * homeCategory/propertyType tab-grouping entirely. */
  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  /** Raw exact-transactionType filter — same SEO-browse-page-only usage as `category`. */
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  @IsOptional()
  @IsString()
  cityId?: string;

  /** Raw locality filter — used only by the SEO locality browse-landing pages. */
  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  q?: string;

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

  /** Matches listings with `attributes.bedrooms >= bedrooms` — a "3+" style filter, not exact match. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms?: number;

  /** Matches `attributes.furnished` exactly — same values as the posting wizard's schema
   * (packages/types/src/categoryFields.ts). */
  @IsOptional()
  @IsIn(FURNISHING_VALUES)
  furnished?: (typeof FURNISHING_VALUES)[number];

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 24;
}
