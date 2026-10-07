import { ArrayNotEmpty, IsArray, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';
import { INDIAN_LANGUAGES, type GenerateListingCopyField, type IndianLanguage } from '@bhavano/types/listingCopyAssist';

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
const FIELDS: GenerateListingCopyField[] = ['title', 'description'];

/** Two valid shapes — see GenerateListingCopyInput's own doc comment in
 * `@bhavano/types/listingCopyAssist` for why `listingId` alone vs. the structured fields alone
 * are the only two meaningful combinations; the service, not this DTO, enforces that distinction
 * and ignores structured fields whenever `listingId` is present. */
export class GenerateListingCopyDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(FIELDS, { each: true })
  fields!: GenerateListingCopyField[];

  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  priceQualifier?: string;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsString()
  areaName?: string;

  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsIn(INDIAN_LANGUAGES)
  secondLanguage?: IndianLanguage;
}
