import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';

const LISTING_CATEGORIES: ListingCategory[] = ['house', 'apartment', 'pg', 'storage', 'coworking', 'furniture'];
const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];

export class CreateListingDto {
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoHashes?: string[];

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
