import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateBoostOrderDto {
  @IsString()
  listingId!: string;

  @IsIn([7, 15])
  boostDays!: 7 | 15;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
