import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, Max, Min } from 'class-validator';
import {
  MAX_FEATURED_EXPIRY_DAYS,
  MAX_FEATURED_EXPIRY_STAGES,
  MAX_FOLLOWUP_HOURS,
  MAX_FOLLOWUP_STAGES,
} from '../reminder-settings';

export class UpdateReminderSettingsDto {
  @IsBoolean()
  featuredExpiryEnabled!: boolean;

  /** Days before a Featured period ends, e.g. [3, 1]. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FEATURED_EXPIRY_STAGES)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_FEATURED_EXPIRY_DAYS, { each: true })
  featuredExpiryDays!: number[];

  @IsBoolean()
  followupEnabled!: boolean;

  /** Hours after an ad goes live, e.g. [4, 24, 72]. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FOLLOWUP_STAGES)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_FOLLOWUP_HOURS, { each: true })
  followupHours!: number[];
}
