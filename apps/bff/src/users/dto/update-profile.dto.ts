import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SellerType } from '@bhavano/types';

const SELLER_TYPES: SellerType[] = ['owner', 'agent'];

/** Deliberately has no `email`: an address only enters the profile through the verified flow
 * (POST /users/me/email/request-code then /email/verify), mirroring how a phone only arrives
 * through OTP. See docs/plans/account-linking-phone-and-email.md. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsIn(SELLER_TYPES)
  sellerType?: SellerType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  reraNumber?: string;
}
