import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export const OTP_CHANNELS = ['whatsapp', 'sms'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export class SendOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'phone must be a 10-digit Indian mobile number',
  })
  phone!: string;

  /** Where to deliver the code. Omitted means the server default (WhatsApp first, SMS if that
   * fails); `sms` is the "send by SMS instead" fallback the login screens offer. */
  @IsOptional()
  @IsIn(OTP_CHANNELS)
  channel?: OtpChannel;
}
