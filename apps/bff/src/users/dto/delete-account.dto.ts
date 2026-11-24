import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { phoneErrorMessage } from '@bhavano/types/market';
import { MARKET } from '../../market/market-config';

/** Deletion is irreversible, so it re-proves ownership rather than trusting the session alone:
 * a borrowed unlocked phone should not be enough to erase someone's account and take their
 * listings offline. Exactly one identifier, with a code just issued for it. */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @Matches(MARKET.phoneNationalPattern, {
    message: phoneErrorMessage(MARKET.id),
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
