import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { SubscriptionTier } from '@bhavano/types';

export class CreateSubscriptionOrderDto {
  @IsIn(['buyerPremium', 'agentPro', 'sellerSlotPack'])
  tier!: SubscriptionTier;

  @IsIn([1, 6, 12])
  months!: 1 | 6 | 12;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  agentProUnits?: number;
}
