import { IsIn, IsOptional, IsString } from 'class-validator';
import type { ListingCategory } from '@bhavano/types';

// Same literal list create-listing.dto.ts/list-listings.dto.ts already validate against.
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

export class PreviewBoostPricingDto {
  @IsIn(LISTING_CATEGORIES)
  category!: ListingCategory;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
