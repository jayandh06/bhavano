import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { ListingCategory, ListingStatus, TransactionType } from '@bhavano/types';
import type { AreaUnit } from '@bhavano/types/areaUnit';

const AREA_UNITS: AreaUnit[] = ['sqft', 'sqm', 'acre', 'hectare', 'cent'];
const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented', 'deactivated'];
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

  // Three states: omitted = leave the listing's current whole-price/per-unit state alone; `null`
  // = explicitly switch back to a whole-price listing (passes `@IsIn` trivially — `@IsOptional`
  // treats both undefined and null as "skip further validation"); a real AreaUnit = set/change
  // it. See `UpdateListingInput.priceUnit`'s own doc comment for the full contract.
  @IsOptional()
  @IsIn(AREA_UNITS)
  priceUnit?: AreaUnit | null;

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

/** Admin-only superset of `UpdateListingDto` — bound exclusively to the admin PATCH route
 * (`AdminController.updateListing`). Category/transactionType/city/area/lat/lng are deliberately
 * absent from the base `UpdateListingDto` the owner-facing route uses, so Nest's global
 * `whitelist: true` ValidationPipe strips them from any owner request before it ever reaches
 * `ListingsService` — that binding choice, not a runtime role check, is what keeps owners from
 * self-editing these fields. See docs/plans/admin-edit-location-and-category.md. */
export class AdminUpdateListingDto extends UpdateListingDto {
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
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  areaName?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}
