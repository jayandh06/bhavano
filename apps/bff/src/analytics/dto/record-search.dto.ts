import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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

/** What a visitor searched for, already resolved by the page that rendered it — so nothing here
 * has to be re-parsed out of a URL. `sessionId` is absent on purpose: web's route handler reads
 * it from the httpOnly cookie server-side, because a client that could name its own session
 * could also attribute a search to somebody else's. */
export class RecordSearchDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsString()
  @MaxLength(500)
  path!: string;

  /** Free text. Capped hard — anything can be typed into a search box, and a runaway value has
   * no business reaching the database. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cityId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  areaIds?: string[];

  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  bedrooms?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  furnished?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sort?: string;

  /** The whole reason the table exists: zero is the inventory-gap signal. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  resultCount!: number;
}
