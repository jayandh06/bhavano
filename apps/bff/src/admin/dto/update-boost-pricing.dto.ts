import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';

// Same literal list preview-boost-pricing.dto.ts already validates against.
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

export class BoostPriceBandDto {
  /** `null` marks the open-ended top band. `IsOptional` here means "or null" rather than its
   * usual "field may be absent" — class-validator treats a `null` value the same as a missing
   * one and skips the remaining validators either way, which is exactly the composition
   * IsInt/IsPositive don't offer on their own. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxValue!: number | null;

  @IsInt()
  @Min(1)
  price7d!: number;

  @IsInt()
  @Min(1)
  price15d!: number;

  @IsInt()
  @Min(1)
  price30d!: number;
}

export class BoostPricingRuleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(LISTING_CATEGORIES, { each: true })
  categories!: ListingCategory[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(TRANSACTION_TYPES, { each: true })
  transactionTypes!: TransactionType[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BoostPriceBandDto)
  bands!: BoostPriceBandDto[];
}

export class UpdateBoostPricingDto {
  @IsInt()
  @Min(1)
  propertyBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  propertyBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  propertyBoostPrice30d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice30d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice30d!: number;

  @IsBoolean()
  showSelectorOnPreview!: boolean;

  @IsBoolean()
  boost7dEnabled!: boolean;

  @IsBoolean()
  boost15dEnabled!: boolean;

  @IsBoolean()
  boost30dEnabled!: boolean;

  @IsBoolean()
  allowSkippingBoost!: boolean;

  /** Optional price-by-listing-value overrides — see
   * docs/plans/boost-proof-stat-and-value-bands.md. Omitted/undefined leaves whatever's already
   * saved untouched (BoostPricingSettingsService's update, not a clear); an explicit empty array
   * clears every rule back to flat-tier-only pricing. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoostPricingRuleDto)
  valueBandRules?: BoostPricingRuleDto[];
}
