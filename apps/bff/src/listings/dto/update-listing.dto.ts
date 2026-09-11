import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { ListingStatus } from '@bhavano/types';

const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented', 'deactivated'];

export class UpdateListingDto {
  // 0 ("Contact for price") is valid for pg/coworking only — enforced in
  // ListingsService.assertValidPrice, not here, since it depends on the listing's category.
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  priceQualifier?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specs?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsIn(LISTING_STATUSES)
  status?: ListingStatus;
}
