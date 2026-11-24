import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { phoneErrorMessage } from '@bhavano/types/market';
import { MARKET } from '../../market/market-config';

export const OTP_CHANNELS = ['whatsapp', 'sms'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export class SendOtpDto {
  @IsString()
  @Matches(MARKET.phoneNationalPattern, {
    message: phoneErrorMessage(MARKET.id),
  })
  phone!: string;

  /** Where to deliver the code. Omitted means the server default (WhatsApp first, SMS if that
   * fails); `sms` is the "send by SMS instead" fallback the login screens offer. */
  @IsOptional()
  @IsIn(OTP_CHANNELS)
  channel?: OtpChannel;
}
