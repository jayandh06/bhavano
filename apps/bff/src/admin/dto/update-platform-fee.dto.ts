import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdatePlatformFeeDto {
  @IsInt()
  @Min(0)
  propertyListingFee!: number;

  @IsInt()
  @Min(0)
  coworkingPgStorageListingFee!: number;

  @IsInt()
  @Min(0)
  furnitureInteriorsListingFee!: number;

  @IsBoolean()
  allowLivePublishWithPendingPayment!: boolean;
}
