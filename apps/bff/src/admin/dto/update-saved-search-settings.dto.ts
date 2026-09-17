import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateSavedSearchSettingsDto {
  /** 0 disables the free tier entirely, putting alerts back behind Bhavano Plus — see
   * SavedSearchSetting.freeAlertsPerUser. Capped low deliberately: this is a give-away to seed
   * demand capture, and an accidental large number would hand out an unbounded paid feature. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  freeAlertsPerUser!: number;
}
