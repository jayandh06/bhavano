import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { ListingCategory, SellerType, TransactionType } from '@bhavano/types';
import type { AreaUnit } from '@bhavano/types/areaUnit';
import {
  AREA_NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '@bhavano/types/listingLimits';

const SELLER_TYPES: SellerType[] = ['owner', 'agent'];

const AREA_UNITS: AreaUnit[] = ['sqft', 'sqm', 'acre', 'hectare', 'cent'];

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

export class CreatedPhotoInputDto {
  @IsInt()
  @Min(1)
  photoNo!: number;

  @IsString()
  hash!: string;

  @IsString()
  ext!: string;
}

export class ListingCheckoutIntentDto {
  @IsOptional()
  @IsIn([7, 15, 30])
  boostDays?: 7 | 15 | 30;

  @IsOptional()
  @IsBoolean()
  includeInstantAlerts?: boolean;
}

export class CreatedVideoInputDto {
  @IsString()
  storageId!: string;

  @IsString()
  ext!: string;

  @IsInt()
  @Min(1)
  durationSec!: number;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CreateListingDto {
  @IsUUID()
  id!: string;

  @IsIn(LISTING_CATEGORIES)
  category!: ListingCategory;

  @IsIn(TRANSACTION_TYPES)
  transactionType!: TransactionType;

  // 0 ("Contact for price") is valid for pg/coworking only — enforced in
  // ListingsService.assertValidPrice, not here, since it depends on `category`.
  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  priceQualifier?: string;

  @IsOptional()
  @IsIn(AREA_UNITS)
  priceUnit?: AreaUnit;

  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AREA_NAME_MAX_LENGTH)
  areaName?: string;

  @IsString()
  cityId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specs?: string[];

  // 4000 is generous for a classified ad and still bounded — the column is TEXT, so without a
  // limit here a single listing could carry a novel.
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatedPhotoInputDto)
  photos!: CreatedPhotoInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatedVideoInputDto)
  videos?: CreatedVideoInputDto[];

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  /// Links this listing to the OutreachContact it was bulk-imported from (bulk_upload_listings.py
  /// only — never set by the normal posting wizard) — see ListingsService.claimListing.
  @IsOptional()
  @IsString()
  claimContactId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ListingCheckoutIntentDto)
  checkoutIntent?: ListingCheckoutIntentDto;

  /// The poster's answer to "Owner or agent?" — saved onto User.sellerType. See CreateListingInput.
  @IsOptional()
  @IsIn(SELLER_TYPES)
  postedAs?: SellerType;

  /// The visitor's analytics session (web bhavano_sid / mobile's own uuid) — lets the server
  /// record the /post/success page-view trail entry itself once this listing actually goes live,
  /// rather than trusting a client-side fire-and-forget request after the fact (which silently
  /// drops on a network blip, an ad/privacy blocker, or the app backgrounding). Absent for
  /// outreach/admin-created listings, which have no browser/app session at all.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
