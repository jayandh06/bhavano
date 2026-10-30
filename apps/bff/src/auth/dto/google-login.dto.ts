import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  idToken!: string;

  /** First-touch attribution captured by web's middleware.ts — see AuthService.loginWithGoogle. */
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

  /** Google Ads click-identifying params, captured the same way as the acquisition* fields
   * above — see VisitContext. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionGclid?: string;

  /** Facebook / Instagram click id and the Pixel's `_fbp` browser id, captured like the Google ids above (Meta Conversions API). */
  @IsOptional()
  @IsString()
  @Matches(/^[\w-]+$/)
  @MaxLength(300)
  acquisitionFbclid?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\w.-]+$/)
  @MaxLength(100)
  acquisitionFbp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionCampaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionAdGroupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  acquisitionAdId?: string;

  /** See VerifyOtpDto.sessionId — same purpose, for the Google login path. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  /** See VerifyOtpDto.viewerKey — same purpose, for the Google login path. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  viewerKey?: string;

  /** See VerifyOtpDto.referralCode — same purpose, for the Google login path. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;
}
