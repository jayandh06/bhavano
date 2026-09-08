import { IsBoolean } from 'class-validator';

export class SetDiscountCodeActiveDto {
  @IsBoolean()
  active!: boolean;
}
