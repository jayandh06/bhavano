import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { ListingStatus } from '@bhavano/types';

const LISTING_STATUSES: ListingStatus[] = ['active', 'sold', 'rented', 'deactivated'];

export class UpdateListingDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
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
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsIn(LISTING_STATUSES)
  status?: ListingStatus;
}
