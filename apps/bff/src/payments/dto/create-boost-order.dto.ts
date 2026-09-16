import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateBoostOrderDto {
  @IsString()
  listingId!: string;

  @IsIn([7, 15])
  boostDays!: 7 | 15;

  @IsOptional()
  @IsString()
  discountCode?: string;

  /** Buys Instant Alerts alongside this boost in one payment — see
   * PaymentsService.createBoostOrder's own doc comment. */
  @IsOptional()
  @IsBoolean()
  includeInstantAlerts?: boolean;
}
