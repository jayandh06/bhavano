import { IsIn, IsString } from 'class-validator';

export class CreateBoostOrderDto {
  @IsString()
  listingId!: string;

  @IsIn([7, 15])
  boostDays!: 7 | 15;
}
