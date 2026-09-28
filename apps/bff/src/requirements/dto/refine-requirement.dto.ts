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
} from 'class-validator';
import type { ListingCategory, TransactionType } from '@bhavano/types';
import type { AreaUnit } from '@bhavano/types/areaUnit';
import { MAX_BEDROOMS } from '@bhavano/types/bedrooms';
import { MAX_REQUIREMENT_AREAS, type RequirementAttributes } from '@bhavano/types/requirementQuestions';
import { LISTING_CATEGORIES, TRANSACTION_TYPES } from './create-requirement.dto';

const AREA_UNITS: AreaUnit[] = ['sqft', 'sqm', 'acre', 'hectare', 'cent'];

/**
 * One step of the refinement questions — docs/plans/requirement-refinement-questions.md.
 *
 * Every field optional so each step saves on its own, and a seeker who stops after one question
 * still leaves a better requirement than the one they started with. `null` clears a value; an
 * absent field leaves it alone. Cross-field rules (areas in the city, transaction valid for the
 * category, attributes the category declares) live in the service, which has the row.
 */
export class RefineRequirementDto {
  @IsOptional()
  @IsIn(LISTING_CATEGORIES)
  category?: ListingCategory | null;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  transactionType?: TransactionType | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REQUIREMENT_AREAS)
  @IsString({ each: true })
  areaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BEDROOMS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_BEDROOMS, { each: true })
  bedroomOptions?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minAreaSqft?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAreaSqft?: number | null;

  @IsOptional()
  @IsIn(AREA_UNITS)
  areaUnit?: AreaUnit | null;

  @IsOptional()
  @IsObject()
  attributes?: RequirementAttributes;

  @IsOptional()
  @IsDateString()
  moveInBy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
