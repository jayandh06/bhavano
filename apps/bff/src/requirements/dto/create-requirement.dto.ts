import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import { MAX_REQUIREMENT_AREAS, type RequirementAttributes } from '@bhavano/types/requirementQuestions';

export const LISTING_CATEGORIES: ListingCategory[] = [
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
export const TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'rent', 'lease'];

/** Mirrors CreateSavedSearchDto's criteria vocabulary deliberately — the same fields the matcher
 * already speaks, so one prompt can create both without translating between two shapes. */
export class CreateRequirementDto {
  /** How the search was described to the seeker, e.g. "2 BHK apartments for rent in Koramangala,
   * Bengaluru". Doubles as the alert's name when one is created alongside. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  searchLabel!: string;

  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType;

  /** Required — a requirement for "anywhere in India" is not one anybody can act on, so the
   * capture card asks for a city first. The service also checks it is a real one. */
  @IsString({ message: 'Pick a city first' })
  @MinLength(1, { message: 'Pick a city first' })
  cityId!: string;

  @IsOptional()
  @IsString()
  areaId?: string;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms?: number;

  /** Every area the search named. The web caller leaves it out when more than
   * MAX_REQUIREMENT_AREAS were ticked — that many is not a specific ask, and the areas question
   * gets it instead. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUIREMENT_AREAS)
  @IsString({ each: true })
  areaIds?: string[];

  /** The whole BHK set the search had ticked, not just its smallest. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BEDROOMS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_BEDROOMS, { each: true })
  bedroomOptions?: number[];

  /** Facet filters the search had set. Checked against the category in the service, where an
   * unknown key is dropped rather than failing the capture. */
  @IsOptional()
  @IsObject()
  attributes?: RequirementAttributes;

  /** The seeker's own words, when the flow asked for them. The Phase 0 one-tap capture leaves
   * this empty on purpose — it worked precisely because it was not a form. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsDateString()
  moveInBy?: string;

  /** The page the empty search happened on — what makes "which areas have no supply" answerable
   * later. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingPath?: string;

  /** "May owners and agents with a matching property contact you directly?" Absent is no: this
   * gates whether the seeker's number can ever be handed to a third party, so the permissive
   * reading must be the one that requires an explicit answer. */
  @IsOptional()
  @IsBoolean()
  contactConsent?: boolean;
}
