import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class AppleLoginDto {
  @IsString()
  identityToken!: string;

  /** From `AppleAuthentication.signInAsync()`'s own response, never from the token — Apple's
   * identity token never carries a name at all, and the SDK only returns one on the very first
   * authorization for a given user+app. Absent on every later login. See
   * AuthService.loginWithApple. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  /** Same first-touch attribution fields as GoogleLoginDto — see VisitContext. */
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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  /** See VerifyOtpDto.viewerKey — same purpose, for the Apple login path. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  viewerKey?: string;

  /** See VerifyOtpDto.referralCode — same purpose, for the Apple login path. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;
}
