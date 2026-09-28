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
}
