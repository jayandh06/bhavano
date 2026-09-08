import { IsOptional, IsString } from 'class-validator';

export class CreateContactRevealCreditsOrderDto {
  @IsOptional()
  @IsString()
  discountCode?: string;
}
