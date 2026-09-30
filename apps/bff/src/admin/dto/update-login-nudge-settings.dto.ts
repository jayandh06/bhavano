import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpdateLoginNudgeSettingsDto {
  @IsBoolean()
  webOneTapEnabled!: boolean;

  @IsBoolean()
  webPromptEnabled!: boolean;

  // Floor of 2: the card must never appear on the page a visitor arrived on from search or an ad.
  @IsInt()
  @Min(2)
  @Max(50)
  webPromptAfterDetailViews!: number;

  @IsInt()
  @Min(0)
  @Max(120)
  webPromptDelaySeconds!: number;

  @IsBoolean()
  excludeAdAndSearchLanding!: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  webPromptRolloutPercent!: number;

  @IsBoolean()
  appPromptEnabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(50)
  appPromptAfterDetailViews!: number;

  @IsInt()
  @Min(0)
  @Max(90)
  dismissCooldownDays!: number;
}
