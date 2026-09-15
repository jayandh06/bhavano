import { IsOptional, IsString } from 'class-validator';

export class CreateInstantAlertsOrderDto {
  @IsString()
  listingId!: string;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
