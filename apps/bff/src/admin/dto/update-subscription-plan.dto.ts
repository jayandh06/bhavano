import { IsInt, Min } from 'class-validator';

export class UpdateSubscriptionPlanDto {
  @IsInt()
  @Min(1)
  freeListingSlots!: number;

  @IsInt()
  @Min(1)
  sellerSlotPackTotalSlots!: number;

  @IsInt()
  @Min(1)
  sellerSlotPackMonthlyPrice!: number;

  @IsInt()
  @Min(1)
  proListingSlotsPerUnit!: number;

  @IsInt()
  @Min(1)
  agentProMonthlyPricePerUnit!: number;

  @IsInt()
  @Min(1)
  buyerPremiumPrice1Month!: number;

  @IsInt()
  @Min(1)
  buyerPremiumPrice6Months!: number;

  @IsInt()
  @Min(1)
  buyerPremiumPrice12Months!: number;
}
