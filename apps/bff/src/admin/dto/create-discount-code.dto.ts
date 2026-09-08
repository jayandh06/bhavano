import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateDiscountCodeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/, {
    message: 'code must be 3-32 characters, letters/digits/underscore/hyphen only',
  })
  code!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionsPerUser?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
