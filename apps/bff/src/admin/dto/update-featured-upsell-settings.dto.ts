import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpdateFeaturedUpsellSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  listingCardEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(720)
  minAgeHours!: number;

  @IsInt()
  @Min(0)
  @Max(90)
  quietDays!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxShowsPerAd!: number;
}
