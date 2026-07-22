import { IsIn } from 'class-validator';
import type { SubscriptionTier } from '@bhavano/types';

export class CreateSubscriptionOrderDto {
  @IsIn(['buyerPremium', 'agentPro'])
  tier!: SubscriptionTier;

  @IsIn([1, 12])
  months!: 1 | 12;
}
