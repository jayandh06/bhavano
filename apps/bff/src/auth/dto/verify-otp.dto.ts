import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a 10-digit Indian mobile number' })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;

  /** First-touch attribution captured by web's middleware.ts — only used on signup (see
   * AuthService.verifyOtp); ignored by the otp/link endpoint, which reuses this same DTO. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionCampaign?: string;

  /** The visitor's per-session id (web's `bhavano_sid` cookie) — lets AuthService link the
   * anonymous Visit row logged for this session to the now-known user. Ignored by otp/link,
   * which reuses this same DTO. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
