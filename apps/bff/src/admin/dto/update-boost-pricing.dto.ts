import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateBoostPricingDto {
  @IsInt()
  @Min(1)
  propertyBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  propertyBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice15d!: number;

  @IsBoolean()
  showSelectorOnPreview!: boolean;
}
