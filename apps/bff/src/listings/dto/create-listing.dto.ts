import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatedPhotoInputDto)
  photos!: CreatedPhotoInputDto[];

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
