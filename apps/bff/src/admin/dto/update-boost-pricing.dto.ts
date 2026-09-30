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
  propertyBoostPrice30d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  coworkingPgStorageBoostPrice30d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice7d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice15d!: number;

  @IsInt()
  @Min(1)
  furnitureInteriorsBoostPrice30d!: number;

  @IsBoolean()
  showSelectorOnPreview!: boolean;

  @IsBoolean()
  boost7dEnabled!: boolean;

  @IsBoolean()
  boost15dEnabled!: boolean;

  @IsBoolean()
  boost30dEnabled!: boolean;
}
