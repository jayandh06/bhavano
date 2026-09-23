import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateListingPublishOrderDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsIn([7, 15])
  boostDays?: 7 | 15;

  @IsOptional()
  @IsBoolean()
  includeInstantAlerts?: boolean;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
