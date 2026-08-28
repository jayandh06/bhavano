import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

/** Deletion is irreversible, so it re-proves ownership rather than trusting the session alone:
 * a borrowed unlocked phone should not be enough to erase someone's account and take their
 * listings offline. Exactly one identifier, with a code just issued for it. */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'phone must be a 10-digit Indian mobile number',
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
