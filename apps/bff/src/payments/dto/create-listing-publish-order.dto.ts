import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateListingPublishOrderDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsIn([7, 15, 30])
  boostDays?: 7 | 15 | 30;

  @IsOptional()
  @IsBoolean()
  includeInstantAlerts?: boolean;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
