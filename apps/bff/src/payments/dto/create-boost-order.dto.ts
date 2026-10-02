import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PURCHASE_SOURCES, type PurchaseSource } from '@bhavano/types/purchaseSource';

export class CreateBoostOrderDto {
  @IsString()
  listingId!: string;

  @IsIn([7, 15, 30])
  boostDays!: 7 | 15 | 30;

  @IsOptional()
  @IsString()
  discountCode?: string;

  /** Buys Instant Alerts alongside this boost in one payment — see
   * PaymentsService.createBoostOrder's own doc comment. */
  @IsOptional()
  @IsBoolean()
  includeInstantAlerts?: boolean;

  /** Where the checkout was started from — see @bhavano/types/purchaseSource. */
  @IsOptional()
  @IsIn(PURCHASE_SOURCES)
  source?: PurchaseSource;

  /** Redeem a referral boost credit instead of paying — see PaymentsService.createBoostOrder's
   * own doc comment and docs/plans/bhavano-referral-program-implementation.md's Phase 2. When
   * true, the actual boost length comes from whichever credit batch gets redeemed (its own
   * `daysGranted`, set when the referral reward was granted), not from `boostDays` above — the
   * field is still required by this DTO so the normal paid-purchase shape doesn't need two
   * validation paths, but its value is ignored on this branch. */
  @IsOptional()
  @IsBoolean()
  useReferralCredit?: boolean;
}
