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

  /** The listing this preview is for — lets pricing use the listing's own value band (see
   * docs/plans/boost-proof-stat-and-value-bands.md) instead of just the flat per-category price.
   * Optional only for backward compatibility with a caller on an older build; every current
   * caller (BoostBundlePicker/BoostBundleCard) already has a real listingId in hand. */
  @IsOptional()
  @IsString()
  listingId?: string;
}
