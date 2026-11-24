import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { phoneErrorMessage } from '@bhavano/types/market';
import { MARKET } from '../../market/market-config';

/** Exactly one of these identifies the account being merged in. It must be one the caller
 * already proved in the request that returned `confirm` — the service re-checks that the
 * identifier is still verified against this session before moving anything. */
export class ConfirmMergeDto {
  @IsOptional()
  @IsString()
  @Matches(MARKET.phoneNationalPattern, {
    message: phoneErrorMessage(MARKET.id),
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  /** The same code proven in the request that returned `confirm`. Still valid because that
   * request deliberately did not consume the challenge. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
