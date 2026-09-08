import { IsInt, Min } from 'class-validator';

export class UpdateContactRevealSettingsDto {
  @IsInt()
  @Min(0)
  freeRevealsPerUser!: number;

  @IsInt()
  @Min(1)
  creditPackSize!: number;

  @IsInt()
  @Min(1)
  creditPackPriceRupees!: number;

  @IsInt()
  @Min(1)
  creditExpiryMonths!: number;
}
