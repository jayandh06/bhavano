import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
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

export class CreatedPhotoInputDto {
  @IsInt()
  @Min(1)
  photoNo!: number;

  @IsString()
  hash!: string;

  @IsString()
  ext!: string;
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

  @IsInt()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsString()
  priceQualifier?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
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
  @MaxLength(4000)
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
}
